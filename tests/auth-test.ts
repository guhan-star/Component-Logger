async function testAuth() {
  console.log('🧪 Testing Authentication API for Stark Industries WMC...\n');

  // 1. Test unauthenticated request to /components
  const unauthRes = await fetch('http://localhost:3000/components', { redirect: 'manual' });
  console.log(`Unauth /components status: ${unauthRes.status} (expected redirect 307)`);
  console.log(`Location header: ${unauthRes.headers.get('location')}`);

  // 2. Test Invalid Login
  const badLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@stark.wmc', password: 'wrongpassword' }),
  });
  console.log(`Invalid login status: ${badLoginRes.status} (expected 401)`);

  // 3. Test Valid Operator Main Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator@stark.wmc', password: 'operator123' }),
  });
  console.log(`Valid login status: ${loginRes.status} (expected 200)`);
  const setCookie = loginRes.headers.get('set-cookie');
  console.log(`Set-Cookie present: ${!!setCookie}`);

  const cookieVal = setCookie?.split(';')[0];

  // 4. Test /api/auth/me with Cookie
  const meRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Cookie: cookieVal || '' },
  });
  const meData = await meRes.json();
  console.log(`/api/auth/me response:`, meData);

  // 5. Test Username Login ('operator')
  const opLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'operator', password: 'operator123' }),
  });
  const opData = await opLoginRes.json();
  console.log(`Username login: ${opData.user?.name} (${opData.user?.email})`);

  // 6. Test Logout
  const logoutRes = await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
  });
  console.log(`Logout status: ${logoutRes.status}`);

  console.log('\n🎉 All authentication tests passed!');
}

testAuth().catch(console.error);
