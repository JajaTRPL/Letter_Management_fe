const fs = require('fs');
const files = [
  'src/mahasiswa/profil-mahasiswa/ui/SectionSSO.ts',
  'src/mahasiswa/profil-mahasiswa/ui/SectionDetail.ts',
  'src/mahasiswa/profil-mahasiswa/ui/SectionKeluarga.ts',
  'src/mahasiswa/profil-mahasiswa/ui/SectionSaudara.ts',
  'src/mahasiswa/profil-mahasiswa/ui/SectionBeasiswa.ts',
  'src/mahasiswa/profil-mahasiswa/ProfilMahasiswaUI.ts',
  'src/mahasiswa/profil-mahasiswa/ProfilMahasiswaLogic.ts'
];
for(const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const cleaned = content.replace(/\\\$/g, '$').replace(/\\\`/g, '\`');
  fs.writeFileSync(file, cleaned);
  console.log('Fixed', file);
}
