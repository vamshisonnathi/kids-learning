import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  TrendingUp, Building, Users, DollarSign, 
  Calendar, ArrowUpRight, FileText, Target
} from 'lucide-react';

const SalesHome = () => {
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const studentsRes = await api.getStudents();
      setPlatformStats({
        activeStudents: studentsRes.data.length,
      });
    } catch (error) {
      console.error('Failed to load sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="sales-loading">
        <div className="text-slate-500">Loading sales dashboard...</div>
      </div>
    );
  }

  const mockPipeline = [
    { district: 'Austin ISD', seats: 12000, stage: 'Pilot', value: '$180K', progress: 60 },
    { district: 'Houston ISD', seats: 45000, stage: 'Proposal', value: '$675K', progress: 30 },
    { district: 'Dallas ISD', seats: 30000, stage: 'Discovery', value: '$450K', progress: 15 },
    { district: 'San Antonio ISD', seats: 20000, stage: 'Negotiation', value: '$300K', progress: 80 },
  ];

  return (
    <div className="space-y-8" data-testid="sales-home">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Sales Dashboard</h1>
        <p className="text-slate-500 mt-1">District licensing pipeline & metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pipeline Value</p>
                <p className="text-3xl font-bold text-slate-800">$1.6M</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
              +23% from last quarter
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Pilots</p>
                <p className="text-3xl font-bold text-slate-800">4</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">Across Texas districts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Seats</p>
                <p className="text-3xl font-bold text-slate-800">107K</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">In pipeline</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Platform Students</p>
                <p className="text-3xl font-bold text-slate-800">{platformStats?.activeStudents || 0}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-2">Demo accounts active</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            District Pipeline
          </CardTitle>
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 text-sm font-medium text-slate-500">District</th>
                  <th className="text-center p-3 text-sm font-medium text-slate-500">Seats</th>
                  <th className="text-center p-3 text-sm font-medium text-slate-500">Value</th>
                  <th className="text-center p-3 text-sm font-medium text-slate-500">Stage</th>
                  <th className="p-3 text-sm font-medium text-slate-500">Progress</th>
                </tr>
              </thead>
              <tbody>
                {mockPipeline.map((deal) => (
                  <tr key={deal.district} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-800">{deal.district}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-slate-600">
                      {deal.seats.toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-800">
                      {deal.value}
                    </td>
                    <td className="p-3 text-center">
                      <Badge className={`${
                        deal.stage === 'Negotiation' ? 'bg-emerald-100 text-emerald-700' :
                        deal.stage === 'Pilot' ? 'bg-blue-100 text-blue-700' :
                        deal.stage === 'Proposal' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {deal.stage}
                      </Badge>
                    </td>
                    <td className="p-3 w-40">
                      <Progress value={deal.progress} className="h-2" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Upcoming Demos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { district: 'Fort Worth ISD', date: 'Feb 15, 2026', type: 'Product Demo', attendees: 8 },
              { district: 'El Paso ISD', date: 'Feb 18, 2026', type: 'Pilot Review', attendees: 5 },
              { district: 'Corpus Christi ISD', date: 'Feb 22, 2026', type: 'Discovery Call', attendees: 3 },
            ].map((meeting) => (
              <div key={meeting.district} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800">{meeting.district}</p>
                  <p className="text-sm text-slate-500">{meeting.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">{meeting.date}</p>
                  <p className="text-xs text-slate-400">{meeting.attendees} attendees</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesHome;
