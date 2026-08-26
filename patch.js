const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  
  if (content.includes('try {') && content.includes('} catch (err: any) {')) {
    console.log(filepath + ' already patched');
    return;
  }

  // Find the start of the function body
  const defaultExportMatch = content.match(/export\s+default\s+async\s+function\s+\w+\(\)\s*\{/);
  if (!defaultExportMatch) {
    console.log('Could not find default export in ' + filepath);
    return;
  }

  const funcStart = defaultExportMatch.index + defaultExportMatch[0].length;
  
  // Wrap the entire body in try/catch
  const body = content.slice(funcStart, content.lastIndexOf('}'));
  
  const newContent = content.slice(0, funcStart) + '\n  try {' + body + 
    '\n  } catch (err: any) {\n    return <div className="p-8 bg-red-950/20 text-red-500 font-mono text-sm whitespace-pre-wrap border border-red-500/50 m-4 rounded-xl"><b>PRODUCTION ERROR:</b><br/>{err.stack || err.message || String(err)}</div>;\n  }\n}';
  
  fs.writeFileSync(filepath, newContent);
  console.log('Patched ' + filepath);
}

patchFile('src/app/(dashboard)/projects/page.tsx');
patchFile('src/app/(dashboard)/dashboard/page.tsx');
