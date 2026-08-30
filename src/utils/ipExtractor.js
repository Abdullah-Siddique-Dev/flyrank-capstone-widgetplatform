function extractClientIp(req) {
  let ip = '';
  
  if (req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'].split(',');
    ip = forwarded[0].trim();
  } else if (req.headers['x-real-ip']) {
    ip = req.headers['x-real-ip'].trim();
  } else if (req.ip) {
    ip = req.ip;
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6 localhost / mapped IPv4
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  } else if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip || '127.0.0.1';
}

module.exports = { extractClientIp };
