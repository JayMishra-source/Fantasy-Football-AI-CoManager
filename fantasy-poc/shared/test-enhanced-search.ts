// Test script for enhanced web search functionality
import { enhancedWebSearch } from './src/services/enhancedWebSearch.js';
import { fantasyRSSAggregator } from './src/services/fantasyRSSAggregator.js';
import { comprehensiveWebData } from './src/services/comprehensiveWebData.js';

async function testEnhancedSearch() {
  console.log('🚀 Testing Enhanced Web Search System\n');
  
  const testQueries = [
    'Christian McCaffrey injury news',
    'fantasy football waiver wire week 1 2024',
    'NFL weather forecast this week',
    'start sit running backs week 1'
  ];

  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing query: "${query}"`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Test 1: Enhanced Web Search (fallback to DuckDuckGo)
      console.log('🔍 Test 1: Enhanced Web Search...');
      const searchResult = await enhancedWebSearch.search(query);
      console.log(`Result: ${searchResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      if (searchResult.success) {
        console.log(`Source: ${searchResult.source}`);
        console.log(`Preview: ${searchResult.results?.substring(0, 200)}...`);
      } else {
        console.log(`Error: ${searchResult.error}`);
      }
      console.log();

      // Test 2: Fantasy RSS Aggregation
      console.log('📰 Test 2: Fantasy RSS Aggregation...');
      const rssResult = await fantasyRSSAggregator.searchFantasyNews(query, 3);
      console.log(`Result: ${rssResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Found: ${rssResult.matchingItems.length} matching news items`);
      if (rssResult.matchingItems.length > 0) {
        console.log(`Latest: ${rssResult.matchingItems[0].title}`);
      }
      console.log();

      // Test 3: Comprehensive Web Data
      console.log('🎯 Test 3: Comprehensive Web Data...');
      const comprehensiveResult = await comprehensiveWebData.fantasyFootballSearch(query);
      console.log(`Result: ${comprehensiveResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`Sources: ${comprehensiveResult.sources.join(', ')}`);
      if (comprehensiveResult.summary) {
        console.log(`Summary: ${comprehensiveResult.summary}`);
      }
      console.log(`Preview: ${comprehensiveResult.combinedText?.substring(0, 300)}...`);

    } catch (error: any) {
      console.error(`❌ Test failed for "${query}":`, error.message);
    }

    // Brief pause between queries
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test RSS aggregation separately
  console.log('\n' + '='.repeat(60));
  console.log('Testing RSS Aggregation Features');
  console.log('='.repeat(60));

  try {
    console.log('\n📡 Testing injury reports aggregation...');
    const injuryReports = await fantasyRSSAggregator.getInjuryReports();
    console.log(`Result: ${injuryReports.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Found: ${injuryReports.injuryItems.length} injury-related news items`);
    
    if (injuryReports.injuryItems.length > 0) {
      console.log('\nTop 3 injury reports:');
      injuryReports.injuryItems.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title} (${item.source})`);
      });
    }

    console.log('\n📰 Testing general fantasy news aggregation...');
    const newsAggregation = await fantasyRSSAggregator.aggregateFantasyNews(3);
    console.log(`Result: ${newsAggregation.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Total items: ${newsAggregation.allItems.length}`);
    console.log(`Successful feeds: ${newsAggregation.feedResults.length}`);
    console.log(`Summary: ${newsAggregation.summary}`);

  } catch (error: any) {
    console.error('❌ RSS aggregation test failed:', error.message);
  }

  // Display statistics
  console.log('\n' + '='.repeat(60));
  console.log('Search Statistics');
  console.log('='.repeat(60));

  const stats = enhancedWebSearch.getSearchStats();
  console.log(`Searches performed: ${stats.performed}/${stats.max}`);
  console.log(`Remaining: ${stats.remaining}`);
  console.log(`Available providers: ${stats.availableProviders.join(', ')}`);

  console.log('\n🎉 Enhanced web search testing completed!');
  console.log('\n💡 Next steps:');
  console.log('1. Add API keys to environment variables for better results:');
  console.log('   - SERPER_API_KEY (2,500 free searches)');
  console.log('   - SCRAPINGDOG_API_KEY (1,000 free credits)');
  console.log('2. Install fast-xml-parser: npm install fast-xml-parser');
  console.log('3. Replace simpleWebSearch imports with comprehensiveWebData');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEnhancedSearch().catch(console.error);
}

export { testEnhancedSearch };