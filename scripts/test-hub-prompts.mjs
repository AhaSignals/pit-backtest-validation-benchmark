import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(tmpdir(), 'pit-export-'));
try {
  const source = path.join(root, 'distribution/huggingface'), out = path.join(temp, 'verified');
  const run = (src, dest, extra = []) => spawnSync(process.execPath, ['scripts/export-hub-prompts.mjs','--local',src,'--out',dest,...extra], {cwd:root, encoding:'utf8'});
  let r=run(source,out); assert.equal(r.status,0,r.stderr);
  assert.deepEqual(fs.readdirSync(out).sort(), ['prompts.jsonl','receipt.json']);
  assert(fs.readFileSync(path.join(out,'prompts.jsonl')).equals(fs.readFileSync(path.join(root,'data/v1.1/prompts.jsonl'))));
  const receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json')));
  assert.equal(receipt.source,'local-file-verification');
  assert(!JSON.stringify(receipt).includes(temp));
  assert.notEqual(run(source,out).status,0,'Must not overwrite an existing export');
  assert.notEqual(run(source,path.join(temp,'conflict'),['--hub']).status,0);
  for (const file of ['manifest.json','tables/prompts.jsonl','original/data/v1.1/prompts.jsonl']) {
    const dir = path.join(temp,'broken-'+file.replaceAll('/','-'));
    fs.cpSync(source,dir,{recursive:true});
    fs.appendFileSync(path.join(dir,file),' ');
    const dest=dir+'-output';
    assert.notEqual(run(dir,dest).status,0,'Changed bytes must not pass: '+file);
    assert(!fs.existsSync(dest),'Failed validation must not produce an export');
  }
  console.log('Prompt export verified: pinned hashes, exact pairs, no answer files, corruption rejection, no overwrite.');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
