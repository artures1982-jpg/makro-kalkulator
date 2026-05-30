export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const lang = searchParams.get('lang') || 'pl';

  if (!q || q.length < 2) {
    return new Response(JSON.stringify({ products: [] }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const fields = 'product_name,brands,nutriments,image_small_url';

  // Szukaj najpierw w kraju PL, potem globalnie
  const urls = [
    'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=20&fields=' + fields + '&lc=' + lang + '&cc=pl',
    'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=20&fields=' + fields,
  ];

  let allProducts = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MacroCalc/1.0 (webgen.pl; kontakt@webgen.pl)' }
      });
      const data = await res.json();
      const products = (data.products || []).filter(p => {
        const n = p.nutriments;
        return p.product_name && n && n['energy-kcal_100g'] > 0;
      }).map(p => {
        const n = p.nutriments;
        return {
          name: p.product_name + (p.brands ? ' (' + p.brands.split(',')[0].trim() + ')' : ''),
          kcal: Math.round(n['energy-kcal_100g'] || 0),
          p: Math.round((n['proteins_100g'] || 0) * 10) / 10,
          f: Math.round((n['fat_100g'] || 0) * 10) / 10,
          c: Math.round((n['carbohydrates_100g'] || 0) * 10) / 10,
          img: p.image_small_url || null,
        };
      });

      // Deduplicate
      for (const prod of products) {
        if (!allProducts.find(x => x.name === prod.name)) {
          allProducts.push(prod);
        }
      }

      if (allProducts.length >= 8) break;
    } catch (e) {
      // kontynuuj
    }
  }

  return new Response(JSON.stringify({ products: allProducts.slice(0, 15) }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=3600',
    }
  });
}
