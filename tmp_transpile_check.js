
const ts=require("typescript");
const fs=require("fs");
const files=JSON.parse(process.argv[2]);
let ok=true;
for (const f of files){
  const src=fs.readFileSync(f,'utf8');
  const out=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
  const diags=out.diagnostics||[];
  if(diags.length){
    ok=false;
    console.log('FILE',f);
    for (const d of diags){
      const msg=ts.flattenDiagnosticMessageText(d.messageText,'\n');
      console.log(msg);
    }
  }
}
process.exit(ok?0:1);
