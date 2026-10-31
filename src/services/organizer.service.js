const prisma = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/passwords');

class OrganizerService {
  static async register({ email, password }) {
    const passwordHash = await hashPassword(password);
    return prisma.organizer.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
  }

  static async login({ email, password }) {
    const organizer = await prisma.organizer.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, createdAt: true },
    });

    if (!organizer || !(await verifyPassword(password, organizer.passwordHash))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const { passwordHash, ...safeOrganizer } = organizer;
    return safeOrganizer;
  }
}

module.exports = OrganizerService;
