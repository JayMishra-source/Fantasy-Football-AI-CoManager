#!/usr/bin/env node
import { program } from 'commander';
import dotenv from 'dotenv';
import { initializeEnvironment } from './utils/environment.js';
import { executeThursdayOptimization } from './commands/thursday.js';
import { executeSundayCheck } from './commands/sunday.js';
import { executeMondayAnalysis } from './commands/monday.js';
import { executeTuesdayWaivers } from './commands/tuesday.js';
import { executeCustomWorkflow } from './commands/workflow.js';
import { executePhase4Intelligence, runPhase4Mode, runEmergencyIntelligence } from './commands/phase4.js';

// Load environment variables
dotenv.config();

// Initialize CLI
program
  .name('fantasy-ai')
  .description('Fantasy Football AI Manager - Phase 4 Advanced Intelligence')
  .version('4.0.0');

// Initialize environment (ESPN cookies, LLM config)
program
  .command('init')
  .description('Initialize environment and test connections')
  .action(async () => {
    try {
      console.log('🚀 Initializing Fantasy AI environment...');
      await initializeEnvironment();
      console.log('✅ Environment initialized successfully');
    } catch (error: any) {
      console.error('❌ Initialization failed:', error.message);
      process.exit(1);
    }
  });

// Thursday optimization command
program
  .command('thursday')
  .description('Execute Thursday pre-game lineup optimization')
  .option('--week <number>', 'NFL week number', '1')
  .option('--league <id>', 'League ID override')
  .option('--team <id>', 'Team ID override')
  .action(async (options) => {
    try {
      console.log('🤖 Starting Thursday AI Optimization...');
      const result = await executeThursdayOptimization({
        week: parseInt(options.week),
        leagueId: options.league,
        teamId: options.team
      });
      
      console.log('📊 Results saved to thursday_results.json');
      console.log('✅ Thursday optimization complete');
      
      // Output summary to stdout for GitHub Actions
      process.stdout.write(JSON.stringify({
        success: true,
        summary: result.summary,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Thursday optimization failed:', error.message);
      process.stdout.write(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }));
      process.exit(1);
    }
  });

// Sunday final check command
program
  .command('sunday')
  .description('Execute Sunday final lineup check')
  .option('--week <number>', 'NFL week number', '1')
  .action(async (options) => {
    try {
      console.log('🔍 Starting Sunday Final Check...');
      const result = await executeSundayCheck({
        week: parseInt(options.week)
      });
      
      console.log('✅ Sunday check complete');
      process.stdout.write(JSON.stringify({
        success: true,
        changes: result.changes,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Sunday check failed:', error.message);
      process.exit(1);
    }
  });

// Monday post-game analysis command
program
  .command('monday')
  .description('Execute Monday post-game analysis and waiver prep')
  .option('--week <number>', 'NFL week number', '1')
  .action(async (options) => {
    try {
      console.log('📈 Starting Monday Analysis...');
      const result = await executeMondayAnalysis({
        week: parseInt(options.week)
      });
      
      console.log('✅ Monday analysis complete');
      process.stdout.write(JSON.stringify({
        success: true,
        waiverTargets: result.waiverTargets,
        performance: result.performance,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Monday analysis failed:', error.message);
      process.exit(1);
    }
  });

// Tuesday waiver analysis command
program
  .command('tuesday')
  .description('Execute Tuesday waiver wire analysis')
  .option('--week <number>', 'NFL week number', '1')
  .action(async (options) => {
    try {
      console.log('🎯 Starting Tuesday Waiver Analysis...');
      const result = await executeTuesdayWaivers({
        week: parseInt(options.week)
      });
      
      console.log('✅ Tuesday waiver analysis complete');
      process.stdout.write(JSON.stringify({
        success: true,
        recommendations: result.recommendations,
        coordination: result.coordination,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Tuesday waiver analysis failed:', error.message);
      process.exit(1);
    }
  });

// Custom workflow command
program
  .command('workflow')
  .description('Execute custom AI workflow')
  .requiredOption('--task <task>', 'Workflow task type')
  .option('--week <number>', 'NFL week number', '1')
  .option('--prompt <text>', 'Custom AI prompt')
  .action(async (options) => {
    try {
      console.log(`🔧 Executing custom workflow: ${options.task}`);
      const result = await executeCustomWorkflow({
        task: options.task,
        week: parseInt(options.week),
        prompt: options.prompt
      });
      
      console.log('✅ Custom workflow complete');
      process.stdout.write(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Custom workflow failed:', error.message);
      process.exit(1);
    }
  });

// Utility commands
program
  .command('roster')
  .description('Get current roster information')
  .requiredOption('--league <id>', 'League ID')
  .requiredOption('--team <id>', 'Team ID')
  .action(async (options) => {
    try {
      const { getMyRoster } = await import('@fantasy-ai/shared');
      const roster = await getMyRoster({
        leagueId: options.league,
        teamId: options.team
      });
      
      console.log('📋 Current roster:');
      console.log(JSON.stringify(roster, null, 2));
      
    } catch (error: any) {
      console.error('❌ Failed to get roster:', error.message);
      process.exit(1);
    }
  });

program
  .command('cost')
  .description('Get current LLM usage costs')
  .action(async () => {
    try {
      const { getCostSummary } = await import('@fantasy-ai/shared');
      const costs = await getCostSummary();
      
      console.log('💰 Current costs:');
      console.log(JSON.stringify(costs, null, 2));
      
    } catch (error: any) {
      console.error('❌ Failed to get costs:', error.message);
      process.exit(1);
    }
  });

// Phase 4 Advanced Intelligence Commands
program
  .command('intelligence')
  .description('Execute Phase 4 advanced intelligence analysis')
  .option('--mode <mode>', 'Intelligence mode: full, realtime, learning, analytics, seasonal', 'full')
  .option('--week <number>', 'NFL week number', '1')
  .action(async (options) => {
    try {
      console.log('🧠 Starting Phase 4 Advanced Intelligence...');
      const result = await executePhase4Intelligence({
        mode: options.mode,
        week: parseInt(options.week)
      });
      
      console.log('✅ Advanced intelligence complete');
      process.stdout.write(JSON.stringify({
        success: true,
        intelligence_summary: result.intelligence_summary,
        performance_grade: result.performance_grade,
        key_insights: result.key_insights,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error: any) {
      console.error('❌ Advanced intelligence failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('realtime')
  .description('Run real-time event monitoring and instant decisions')
  .action(async () => {
    try {
      console.log('⚡ Running real-time intelligence...');
      await runPhase4Mode('realtime');
    } catch (error: any) {
      console.error('❌ Real-time intelligence failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('learning')
  .description('Execute adaptive learning cycle')
  .action(async () => {
    try {
      console.log('🧠 Running adaptive learning...');
      await runPhase4Mode('learning');
    } catch (error: any) {
      console.error('❌ Adaptive learning failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('analytics')
  .description('Generate advanced analytics dashboard')
  .action(async () => {
    try {
      console.log('📊 Generating analytics dashboard...');
      await runPhase4Mode('analytics');
    } catch (error: any) {
      console.error('❌ Analytics generation failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('seasonal')
  .description('Process multi-season intelligence')
  .action(async () => {
    try {
      console.log('🔮 Processing seasonal intelligence...');
      await runPhase4Mode('seasonal');
    } catch (error: any) {
      console.error('❌ Seasonal intelligence failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('emergency')
  .description('Emergency intelligence for breaking news/critical decisions')
  .action(async () => {
    try {
      console.log('🚨 Activating emergency intelligence...');
      await runEmergencyIntelligence();
    } catch (error: any) {
      console.error('❌ Emergency intelligence failed:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();