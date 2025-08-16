(async () => {
  try {
    const db = require('./db');
    const prods = await db.getAllProducts();
    const p = prods.find(p => p.name && p.name.includes('Orthoplex'));
    console.log('Found product:', p);
    process.exit(0);
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();
