// LAN settings. `ionic build --configuration lan` uses this file for the real phone.
// The phone cannot reach "localhost": it must call your PC's LAN IP on the same Wi-Fi.
// Replace CHANGE-ME-PC-IP with your IPv4 address (see the PowerShell command below).
export const environment = {
  production: true,
  apiBase: 'http://192.168.8.34:8000/api',
};