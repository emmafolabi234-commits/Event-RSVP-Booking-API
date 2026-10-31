const { verifyAccessToken } = require('../utils/accessTokens');

function createRoleAuthenticator(role) {
  return (req, res, next) => {
    const authorization = req.get('authorization');
    const match = authorization && authorization.match(/^Bearer (.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    let user;
    try {
      user = verifyAccessToken(match[1]);
    } catch (error) {
      return next(error);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
    }
    if (user.role !== role) {
      return res.status(403).json({ success: false, error: 'Insufficient role for this operation' });
    }
    req.user = user;
    return next();
  };
}

module.exports = createRoleAuthenticator;
