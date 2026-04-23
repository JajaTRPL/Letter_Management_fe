const fs = require('fs');
const files = [
  'src/mahasiswa/ScholarshipForm.ts',
  'src/mahasiswa/scholarship-form/Step1Biodata.ts',
  'src/mahasiswa/scholarship-form/Step2Keluarga.ts',
  'src/mahasiswa/scholarship-form/Step3Akademik.ts',
  'src/mahasiswa/scholarship-form/Step4Submit.ts'
];
for(const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const cleaned = content.replace(/\\\$/g, '$').replace(/\\\`/g, '\`');
  fs.writeFileSync(file, cleaned);
  console.log('Fixed', file);
}
