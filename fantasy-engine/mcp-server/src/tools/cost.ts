import { costMonitor } from '../services/costMonitor.js';

export async function getCostSummary(): Promise<{
  success: boolean;
  summary?: any;
  error?: string;
}> {
  try {
    const summary = costMonitor.getCostSummary();
    
    return {
      success: true,
      summary: {
        costs: {
          today: `$${summary.today.toFixed(4)}`,
          this_week: `$${summary.this_week.toFixed(4)}`,
          this_month: `$${summary.this_month.toFixed(4)}`,
          total_all_time: `$${summary.total.toFixed(4)}`
        },
        limits: {
          daily: `$${summary.limits.daily_limit.toFixed(2)}`,
          weekly: `$${summary.limits.weekly_limit.toFixed(2)}`,
          monthly: `$${summary.limits.monthly_limit.toFixed(2)}`,
          per_analysis: `$${summary.limits.per_analysis_limit.toFixed(2)}`
        },
        usage_percentage: {
          daily: `${((summary.today / summary.limits.daily_limit) * 100).toFixed(1)}%`,
          weekly: `${((summary.this_week / summary.limits.weekly_limit) * 100).toFixed(1)}%`,
          monthly: `${((summary.this_month / summary.limits.monthly_limit) * 100).toFixed(1)}%`
        },
        stats: {
          total_analyses: summary.entry_count,
          average_cost_per_analysis: `$${summary.average_per_analysis.toFixed(4)}`
        }
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function getProviderRecommendations(): Promise<{
  success: boolean;
  recommendations?: any[];
  error?: string;
}> {
  try {
    const recommendations = costMonitor.getProviderRecommendations();
    
    return {
      success: true,
      recommendations: recommendations.map(rec => ({
        provider: rec.provider,
        model: rec.model,
        estimated_cost_per_analysis: rec.cost_per_analysis,
        best_for: rec.best_for,
        setup_instructions: `Set ${rec.provider.toUpperCase()}_API_KEY and ${rec.provider.toUpperCase()}_MODEL in environment`
      }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function resetCostTracking(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    costMonitor.resetCosts();
    
    return {
      success: true,
      message: 'Cost tracking has been reset. All previous cost data has been cleared.'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}