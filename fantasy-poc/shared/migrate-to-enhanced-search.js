#!/usr/bin/env node

/**
 * Migration script to update existing code from simpleWebSearch to comprehensiveWebData
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrations = [
  // Import statement updates
  {
    find: /import\s*{\s*simpleWebSearch\s*}\s*from\s*['"](.*?)simpleWebSearch(.js)?['"]/g,
    replace: "import { comprehensiveWebData } from '$1comprehensiveWebData.js'"
  },
  {
    find: /import\s*{\s*simpleWebSearch\s*,\s*SimpleWebSearch\s*}\s*from\s*['"](.*?)simpleWebSearch(.js)?['"]/g,
    replace: "import { comprehensiveWebData, ComprehensiveWebData } from '$1comprehensiveWebData.js'"
  },
  
  // Method call updates  
  {
    find: /simpleWebSearch\.search\(/g,
    replace: "comprehensiveWebData.fantasyFootballSearch("
  },
  {
    find: /simpleWebSearch\.processWebSearchRequests\(/g,
    replace: "comprehensiveWebData.processLLMWebSearchRequests("
  },
  
  // Class instantiation updates
  {
    find: /new\s+SimpleWebSearch\(/g,
    replace: "new ComprehensiveWebData("
  },
  
  // Type reference updates
  {
    find: /:\s*SimpleWebSearch/g,
    replace: ": ComprehensiveWebData"
  }
];

function migrateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    migrations.forEach(migration => {
      if (migration.find.test(content)) {
        content = content.replace(migration.find, migration.replace);
        updated = true;
      }
    });
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

function findTypeScriptFiles(dir, extensions = ['.ts', '.js', '.tsx', '.jsx']) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  console.log('🔄 Starting migration from simpleWebSearch to comprehensiveWebData...\n');
  
  // Find project root directories to scan
  const projectRoot = path.dirname(__dirname); // Go up from shared/
  const scanDirs = [
    path.join(projectRoot, 'shared/src'),
    path.join(projectRoot, 'server/src'),
    path.join(projectRoot, 'client/src'),
    path.join(projectRoot, 'mcp-server/src'),
  ].filter(dir => fs.existsSync(dir));
  
  console.log('📁 Scanning directories:');
  scanDirs.forEach(dir => console.log(`   ${dir}`));
  console.log();
  
  let totalFiles = 0;
  let updatedFiles = 0;
  
  for (const scanDir of scanDirs) {
    console.log(`🔍 Scanning ${scanDir}...`);
    const files = findTypeScriptFiles(scanDir);
    
    for (const file of files) {
      totalFiles++;
      if (migrateFile(file)) {
        updatedFiles++;
      }
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files updated: ${updatedFiles}`);
  console.log(`   No changes needed: ${totalFiles - updatedFiles}`);
  
  if (updatedFiles > 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Install dependencies: npm install fast-xml-parser');
    console.log('2. Rebuild project: npm run build');
    console.log('3. Test enhanced search functionality');
    console.log('4. Consider adding API keys for better results (optional):');
    console.log('   - SERPER_API_KEY (2,500 free searches)');
    console.log('   - SCRAPINGDOG_API_KEY (1,000 free credits)');
  } else {
    console.log('\n💡 No files needed migration. You may be:');
    console.log('   - Already using the enhanced search system');
    console.log('   - Not using web search in scanned directories');
    console.log('   - Using different import patterns');
  }
}

main();