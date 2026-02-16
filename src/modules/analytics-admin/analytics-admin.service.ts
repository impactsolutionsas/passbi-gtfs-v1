import { Injectable, Logger } from '@nestjs/common';
import { SupabaseAdminService } from '../../common/supabase-admin.service';
import { AnalyticsQueryDto, ExportQueryDto, TimeRange } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsAdminService {
	private readonly logger = new Logger(AnalyticsAdminService.name);

	constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

	private getDateRange(timeRange?: TimeRange): { start: string; end: string } {
		const end = new Date();
		const start = new Date();

		switch (timeRange) {
			case TimeRange.DAY:
				start.setDate(start.getDate() - 1);
				break;
			case TimeRange.WEEK:
				start.setDate(start.getDate() - 7);
				break;
			case TimeRange.MONTH:
				start.setMonth(start.getMonth() - 1);
				break;
			case TimeRange.YEAR:
				start.setFullYear(start.getFullYear() - 1);
				break;
			default:
				start.setDate(start.getDate() - 7); // Default to week
		}

		return {
			start: start.toISOString(),
			end: end.toISOString(),
		};
	}

	async getOverview(query: AnalyticsQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get onboarding stats
		const { count: onboardingCount } = await supabase
			.from('user_onboarding')
			.select('*', { count: 'exact', head: true })
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Get sessions stats
		const { count: sessionsCount } = await supabase
			.from('mvp_sessions')
			.select('*', { count: 'exact', head: true })
			.gte('started_at', dateRange.start)
			.lte('started_at', dateRange.end);

		// Get events count
		const { count: eventsCount } = await supabase
			.from('mvp_events')
			.select('*', { count: 'exact', head: true })
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Get active sessions (not ended)
		const { count: activeSessionsCount } = await supabase
			.from('mvp_sessions')
			.select('*', { count: 'exact', head: true })
			.is('ended_at', null);

		return {
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			kpis: {
				onboarding: onboardingCount || 0,
				sessions: sessionsCount || 0,
				events: eventsCount || 0,
				activeSessions: activeSessionsCount || 0,
			},
		};
	}

	async getOnboardingStats(query: AnalyticsQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get total count
		const { count: total } = await supabase
			.from('user_onboarding')
			.select('*', { count: 'exact', head: true })
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Get by gender
		const { data: byGender } = await supabase
			.from('user_onboarding')
			.select('gender')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Get by category
		const { data: byCategory } = await supabase
			.from('user_onboarding')
			.select('category')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Get by platform
		const { data: byPlatform } = await supabase
			.from('user_onboarding')
			.select('platform')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		// Aggregate data
		const genderStats = this.aggregateByField(byGender || [], 'gender');
		const categoryStats = this.aggregateByField(byCategory || [], 'category');
		const platformStats = this.aggregateByField(byPlatform || [], 'platform');

		return {
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			total: total || 0,
			byGender: genderStats,
			byCategory: categoryStats,
			byPlatform: platformStats,
		};
	}

	async getSessionsStats(query: AnalyticsQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get sessions with duration
		const { data: sessions } = await supabase
			.from('mvp_sessions')
			.select('started_at, ended_at, platform')
			.gte('started_at', dateRange.start)
			.lte('started_at', dateRange.end);

		const sessionsData = sessions || [];

		// Calculate average duration
		const sessionsWithDuration = sessionsData
			.filter(s => s.ended_at)
			.map(s => {
				const start = new Date(s.started_at);
				const end = new Date(s.ended_at);
				return (end.getTime() - start.getTime()) / 1000; // Duration in seconds
			});

		const avgDuration = sessionsWithDuration.length > 0
			? sessionsWithDuration.reduce((a, b) => a + b, 0) / sessionsWithDuration.length
			: 0;

		// Get by platform
		const platformStats = this.aggregateByField(sessionsData, 'platform');

		// Get hourly distribution
		const hourlyDistribution = this.getHourlyDistribution(sessionsData);

		return {
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			total: sessionsData.length,
			averageDurationSeconds: Math.round(avgDuration),
			byPlatform: platformStats,
			hourlyDistribution,
		};
	}

	async getEventsStats(query: AnalyticsQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get events
		const { data: events } = await supabase
			.from('mvp_events')
			.select('event_type, created_at')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end);

		const eventsData = events || [];

		// Get by event type
		const eventTypeStats = this.aggregateByField(eventsData, 'event_type');

		// Get daily distribution
		const dailyDistribution = this.getDailyDistribution(eventsData);

		return {
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			total: eventsData.length,
			byEventType: eventTypeStats,
			dailyDistribution,
		};
	}

	async getTrends(query: AnalyticsQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get daily trends for onboarding
		const { data: onboardingTrends } = await supabase
			.from('user_onboarding')
			.select('created_at')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end)
			.order('created_at', { ascending: true });

		// Get daily trends for sessions
		const { data: sessionsTrends } = await supabase
			.from('mvp_sessions')
			.select('started_at')
			.gte('started_at', dateRange.start)
			.lte('started_at', dateRange.end)
			.order('started_at', { ascending: true });

		// Get daily trends for events
		const { data: eventsTrends } = await supabase
			.from('mvp_events')
			.select('created_at')
			.gte('created_at', dateRange.start)
			.lte('created_at', dateRange.end)
			.order('created_at', { ascending: true });

		return {
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			onboarding: this.groupByDate(onboardingTrends || [], 'created_at'),
			sessions: this.groupByDate(sessionsTrends || [], 'started_at'),
			events: this.groupByDate(eventsTrends || [], 'created_at'),
		};
	}

	async exportData(query: ExportQueryDto) {
		const dateRange = query.start_date && query.end_date
			? { start: query.start_date, end: query.end_date }
			: this.getDateRange(query.time_range);

		const supabase = this.supabaseAdmin.getAdminClient();

		// Get all data
		const [onboarding, sessions, events] = await Promise.all([
			supabase.from('user_onboarding').select('*').gte('created_at', dateRange.start).lte('created_at', dateRange.end),
			supabase.from('mvp_sessions').select('*').gte('started_at', dateRange.start).lte('started_at', dateRange.end),
			supabase.from('mvp_events').select('*').gte('created_at', dateRange.start).lte('created_at', dateRange.end),
		]);

		const format = query.format || 'json';

		if (format === 'csv') {
			// Simple CSV conversion (for production, use a proper CSV library)
			return {
				format: 'csv',
				data: {
					onboarding: this.arrayToCSV(onboarding.data || []),
					sessions: this.arrayToCSV(sessions.data || []),
					events: this.arrayToCSV(events.data || []),
				},
			};
		}

		return {
			format: 'json',
			period: {
				start: dateRange.start,
				end: dateRange.end,
			},
			data: {
				onboarding: onboarding.data || [],
				sessions: sessions.data || [],
				events: events.data || [],
			},
		};
	}

	// Helper methods
	private aggregateByField(data: any[], field: string): Record<string, number> {
		const stats: Record<string, number> = {};
		data.forEach(item => {
			const value = item[field] || 'unknown';
			stats[value] = (stats[value] || 0) + 1;
		});
		return stats;
	}

	private getHourlyDistribution(data: any[]): Record<number, number> {
		const distribution: Record<number, number> = {};
		data.forEach(item => {
			const date = new Date(item.started_at || item.created_at);
			const hour = date.getHours();
			distribution[hour] = (distribution[hour] || 0) + 1;
		});
		return distribution;
	}

	private getDailyDistribution(data: any[]): Record<string, number> {
		const distribution: Record<string, number> = {};
		data.forEach(item => {
			const date = new Date(item.created_at);
			const day = date.toISOString().split('T')[0];
			if (day) {
				distribution[day] = (distribution[day] || 0) + 1;
			}
		});
		return distribution;
	}

	private groupByDate(data: any[], dateField: string): Record<string, number> {
		return this.getDailyDistribution(data);
	}

	private arrayToCSV(data: any[]): string {
		if (data.length === 0) return '';
		const headers = Object.keys(data[0]);
		const rows = data.map(item => headers.map(h => JSON.stringify(item[h] || '')).join(','));
		return [headers.join(','), ...rows].join('\n');
	}
}
