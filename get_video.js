const https = require('https');
https.get('https://www.youtube.com/results?search_query=how+to+make+compost', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const ids = data.match(/watch\?v=([A-Za-z0-9_-]{11})/g);
    console.log(ids ? ids.slice(0, 5) : 'none');
  });
});
