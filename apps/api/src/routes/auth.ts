import { Router } from "express";
import { z } from "zod";
import { prisma } from "@swms/db";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { comparePassword } from "../lib/password.js";
import { signAccessToken } from "../lib/jwt.js";
import { UnauthorizedError } from "../lib/httpError.js";
import { recordAudit } from "../services/auditService.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user || !user.isActive) throw new UnauthorizedError("Invalid email or password");

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedError("Invalid email or password");

    const token = signAccessToken({ sub: user.id, role: user.role.name, email: user.email });

    await recordAudit(prisma, {
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      userId: user.id,
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
    });
  }),
);
