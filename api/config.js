// Öffentliche App-Konfiguration (keine Geheimnisse).
// googleClientId: OAuth-Client-ID für „An Google Drive senden“ (optional).
// Die Client-ID ist kein Geheimnis – sie steht ohnehin im Browser.

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
};
