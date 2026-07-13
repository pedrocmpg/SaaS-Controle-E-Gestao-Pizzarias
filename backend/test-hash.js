const bcrypt = require('bcryptjs');

const password = 'Admin@Pizza2024!Segura';
const hashFromDB = '$2a$10$6qe2pmSco2Mkhcmad0i9Pu2RR0pbxLIc6k74yMcgizr8E7rJPngFu';

bcrypt.compare(password, hashFromDB).then(matches => {
  console.log('Senha coincide com hash do banco?', matches);
  if (!matches) {
    console.log('❌ PROBLEMA ENCONTRADO: Senha não bate com hash!');
    console.log('Isso significa que:');
    console.log('1. A senha no .env é diferente da usada no seed original');
    console.log('2. Ou o hash foi corrompido no banco');
  } else {
    console.log('✅ Senha está correta! O problema é outro.');
  }
}).catch(err => console.error('Erro:', err));
