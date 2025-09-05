// Minimal cost monitoring tools for testing

export async function getCostSummary() {
  console.log('Getting cost summary (test mode)');
  return {
    success: true,
    dailyCost: 0.25,
    weeklyCost: 1.50,
    monthlyCost: 6.00,
    totalQueries: 45,
    provider: 'gemini-test',
    message: 'Cost tracking active (test mode)'
  };
}