# How I Built an AI-Native Adaptive Learning Engine for 5th Grade Math

*What actually happened when I tried to replace a $40/month tutoring app with something smarter*

---

My daughter was struggling with fractions. Not "needs a little help" struggling — she'd hit a wall and the tutoring app we were paying for just kept serving her the same problem type on repeat. Wrong answer, try again. Wrong answer, try again. No diagnosis. No adjustment. Just an endless queue of fraction division problems she clearly wasn't ready for.

I'm a software engineer. I build AI systems for a living. So I did what any reasonable parent-engineer does at 11pm on a Tuesday: I decided to build a replacement.

Eight weeks later I had a working adaptive learning engine with a 20-node skill graph, a Socratic tutoring agent that refuses to give answers, and a mastery model that actually knows when a kid is ready to move on. This article is the technical breakdown of how it works.

---

## The Core Problem with Most EdTech Apps

Most adaptive learning apps are adaptive in name only. They adjust difficulty based on a single variable — recent accuracy — and call it personalization. Get three in a row right, difficulty goes up. Get two wrong, it goes down.

The problem is that accuracy on problem X tells you almost nothing about readiness for problem Y if Y has a different prerequisite structure. A student who can add fractions with common denominators might fail fraction division not because the division is hard, but because they never properly learned equivalent fractions. Serving them harder division problems doesn't fix that.

What you actually need is a model of how skills relate to each other — a prerequisite graph — and a system that can figure out where in that graph a student's knowledge actually breaks down.

That's the problem I built toward.

---

## The Skill Graph — 20 Nodes, Directed Edges, Real TEKS Alignment

The foundation is a directed acyclic graph (DAG) of 5th grade math skills, aligned to the Texas Essential Knowledge and Skills (TEKS) standards. Twenty nodes. Each node is a discrete skill. Edges represent prerequisite relationships.

```
place_value_understanding
        ↓
decimal_comparison
        ↓
decimal_operations
        ↓              ↓
fraction_concepts   decimal_to_fraction_conversion
        ↓
equivalent_fractions
        ↓              ↓
fraction_addition   fraction_multiplication
        ↓
fraction_division
```

This is a simplified view. The actual graph has nodes like `prime_factorization`, `LCM_and_GCF`, and `area_of_composite_figures` with multiple incoming and outgoing edges. The key constraint: no cycles. A skill cannot be its own prerequisite.

Why a DAG matters: when a student fails at `fraction_division`, the system doesn't just mark that node as "struggling." It walks the prerequisite chain to find the actual failure point. In practice, most failures at `fraction_division` trace back to gaps at `equivalent_fractions` or `fraction_concepts`. The student isn't failing division — they're failing something earlier that division depends on.

The graph is stored as a JSON adjacency list. Simple, queryable, easy to extend.

```json
{
  "fraction_division": {
    "prerequisites": ["fraction_multiplication", "equivalent_fractions"],
    "teks": "5.3.L",
    "mastery_threshold": 0.85,
    "estimated_problems_to_mastery": 12
  }
}
```

---

## The Mastery Model — Ebbinghaus Without the PhD

I needed a mastery model that was more than an accuracy counter but simple enough to tune without a research team.

I adapted the Ebbinghaus forgetting curve. The core idea from Ebbinghaus (1885): memory retention decays exponentially over time, but each successful recall resets and strengthens the decay curve. The formula for retention at time *t* after learning:

```
R(t) = e^(-t/S)
```

Where *S* is stability — a value that increases with each successful retrieval. In spaced repetition systems like Anki, this becomes the basis for scheduling review intervals.

I adapted this for skill mastery rather than vocabulary recall. Each skill node tracks:

```javascript
{
  skillId: "equivalent_fractions",
  attempts: 14,
  correct: 11,
  recentAccuracy: 0.82,        // last 5 attempts
  stabilityScore: 0.74,        // Ebbinghaus-derived
  lastPracticed: "2026-06-01",
  decayedScore: 0.68,          // stabilityScore adjusted for time since last practice
  masteryStatus: "approaching" // approaching | mastered | at_risk | not_started
}
```

The `decayedScore` is the key field the session planner uses. A student might have a `stabilityScore` of 0.85 (mastered) but if they haven't practiced in three weeks, the `decayedScore` drops to 0.61 — back into "needs review" territory. The system schedules a light review session rather than treating them as starting from zero.

Mastery threshold is 0.85 on `recentAccuracy` maintained across at least 8 attempts, with `decayedScore` above 0.75. Both conditions must hold.

The "dynamic weight reallocation" piece: when the session planner builds a practice session, it allocates problem slots across skills using a weighted distribution based on each skill's `decayedScore` distance from the mastery threshold. Skills further from mastery get more slots. Skills already mastered get maintenance slots at a lower frequency. The weights recalculate after every problem answered.

This is what makes the session actually adaptive rather than just sequenced.

---

## Nova — The Socratic Tutor That Refuses to Answer

The tutoring agent is named Nova. It runs on Claude (claude-3-5-sonnet) via the Anthropic API.

The design constraint I set at the start: Nova never gives the answer. Not even when the student begs. Not even when they've been stuck for ten minutes. This was a deliberate pedagogical choice based on research showing that worked examples and direct answer-giving reduce long-term retention compared to guided retrieval (VanLehn, 2011).

The system prompt is where most of the work lives:

```
You are Nova, a math tutor for 5th graders. Your only job is to help students 
figure out answers themselves. You never give the answer directly.

When a student is stuck:
1. Ask them what they already know about this type of problem
2. Break the problem into the smallest possible first step
3. Ask them to attempt only that step
4. When they get a step right, acknowledge it specifically and move to the next

When a student gives a wrong answer:
- Do not say "incorrect" or "wrong"
- Ask them to explain their reasoning
- Find the specific point where the reasoning breaks down
- Ask a question that targets exactly that point

Current skill context: {skill_name}
Current problem: {problem_text}
Student's last response: {student_response}
Student mastery data: {mastery_context}
```

The `mastery_context` injection is important. Nova gets the student's current `decayedScore` and `recentAccuracy` for the active skill. When a student has a low score, Nova slows down further and uses simpler vocabulary. When a student is close to mastery, Nova introduces slight variations to test generalization.

Example exchange on `equivalent_fractions`:

> **Student:** I don't get how 2/4 and 1/2 are the same
>
> **Nova:** If you had a pizza cut into 4 slices and you took 2, how many slices would be left?
>
> **Student:** 2
>
> **Nova:** So 2 out of 4 slices. Now if someone cut that same pizza into only 2 slices instead, how many would you need to take to get the same amount of pizza?
>
> **Student:** 1?
>
> **Nova:** Exactly. Same amount of pizza, different number of slices. What do you notice about the numbers 2/4 and 1/2?

No answer given. Student arrived at the equivalence themselves. That's the whole game.

---

## Session Planner — How a Session Gets Built

Every session starts with the planner querying the skill graph and the student's current mastery data to build a problem queue.

```javascript
function buildSession(studentId, targetDuration = 20) {
  const skillScores = getMasteryScores(studentId);
  const graph = getSkillGraph();
  
  // Find skills unlocked (all prerequisites mastered)
  const unlocked = getUnlockedSkills(graph, skillScores);
  
  // Calculate weight for each unlocked skill
  const weights = unlocked.map(skill => ({
    skillId: skill.id,
    weight: Math.max(0, MASTERY_THRESHOLD - skillScores[skill.id].decayedScore),
    type: skillScores[skill.id].masteryStatus === 'mastered' ? 'maintenance' : 'practice'
  }));
  
  // Normalize weights, allocate problem slots
  const totalWeight = weights.reduce((sum, s) => sum + s.weight, 0);
  const sessionSlots = Math.floor(targetDuration / AVG_PROBLEM_TIME_MINUTES);
  
  return weights.map(s => ({
    ...s,
    problemCount: Math.round((s.weight / totalWeight) * sessionSlots)
  }));
}
```

A 20-minute session typically runs 8-12 problems across 3-4 skills. The split between practice and maintenance adjusts as the student's overall mastery profile improves.

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo) |
| Backend | Node.js / Express on Railway |
| Database | PostgreSQL — skill graph, mastery scores, session history |
| AI Tutor | Claude claude-3-5-sonnet via Anthropic API |
| Problem Generation | Claude claude-haiku (faster, cheaper for non-tutoring tasks) |
| Auth | Expo SecureStore + JWT |

Problem generation is a separate Claude call — I use Haiku for this to keep costs down. The prompt takes the skill ID, difficulty level, and a flag for whether to generate a novel problem or a variant of one the student got wrong previously. Generated problems get cached by skill + difficulty bucket so we're not paying for generation on every request.

Monthly API cost at current usage: approximately $12-18 for an active student. Compare to $40+/month for competing platforms.

---

## What Actually Broke During Build

**Problem 1: The DAG had cycles.**
I added edges manually at first and created a cycle between `fraction_concepts` and `equivalent_fractions`. The session planner went into an infinite loop trying to find prerequisites. Fix: topological sort validation on every graph modification. If a sort fails, the edge is rejected.

**Problem 2: Students gaming the system.**
A student quickly figured out that if they answered every problem wrong for a skill, the system would route them to an easier skill. Nova doesn't punish wrong answers, so it felt consequence-free. Fix: added a "fatigue detection" layer — three consecutive wrong answers on the same skill type within five minutes triggers a session break suggestion rather than skill switching.

**Problem 3: Nova going off-topic.**
Claude is friendly. Too friendly sometimes. A student asked Nova what its favorite color was and Nova spent three responses on a conversation about blue versus purple before I added a strict topic constraint to the system prompt.

**Problem 4: Mastery inflation.**
Early tuning had the stability score growing too fast. Students were hitting "mastered" status after 6-7 correct answers and the decay wasn't aggressive enough for skills not practiced in 10+ days. Recalibrated the Ebbinghaus decay constant based on observing 3 students over 4 weeks.

---

## Results After 6 Weeks of Testing

Three students, ages 10-11, running 15-25 minute sessions 3-4 times per week.

- Average skill nodes mastered per student after 6 weeks: 7.3 (out of 20)
- Session completion rate: 84% (student completed the planned session without dropping off)
- Reported "I figured it out myself" moments by parents observing sessions: frequent enough that two parents mentioned it unprompted in feedback

I don't have a control group. I'm not running a controlled study. These numbers are directional, not conclusive. What I can say is that the student who was failing fraction division in week 1 diagnosed back to an `equivalent_fractions` gap, spent two weeks there, and passed a school quiz on fraction operations in week 6.

---

## What's Next

- Voice interface for Nova using Whisper STT — typing slows young students down significantly
- Parent dashboard showing the skill graph with mastery status per node visualized
- STAAR test alignment — mapping skill nodes to specific STAAR question patterns so sessions can prioritize based on test proximity
- Expanding the graph to 6th grade skills for students who master the full 5th grade set

The graph expansion is actually the interesting engineering problem. Going from 20 to 60+ nodes while maintaining the prerequisite integrity and keeping session planning performant is not trivial. That's the next article.

---

## References

- Ebbinghaus, H. (1885). *Über das Gedächtnis* (Memory: A Contribution to Experimental Psychology). Leipzig: Duncker & Humblot.
- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197-221.
- Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction, 4*(4), 253-278.

---

*The GitHub repo for this project is at [github.com/vamshisonnathi/kids-learning](https://github.com/vamshisonnathi/kids-learning). The skill graph JSON, session planner, and Nova system prompt are all in there if you want to fork it.*

*Next: [Article 2] — Socratic AI Tutoring: How I Prompted a Model to Never Give the Answer*
