import { and, eq, lt, sql, desc, isNull, or } from "drizzle-orm";

import { drizzle } from "drizzle-orm/mysql2";

import {

  InsertUser,

  users,

  corporateEmails,

  modules,

  userProgress,

  certificates,

  decompressionVideos,

  reminderSettings,

  emailLogs,

  InsertCorporateEmail,

  companies,

  branches,

  sectors,

  userPoints,

  userBadges,

  learningTrails,

  trailModules as trailModulesTable,

  professionalLicenses,

  InsertProfessionalLicense,

  emailCampaigns,
  emailCampaignRecipients,
} from "../drizzle/schema";

import { ENV } from "./_core/env";



let _db: ReturnType<typeof drizzle> | null = null;



export async function getDb() {

  if (!_db && process.env.DATABASE_URL) {

    try {

      _db = drizzle(process.env.DATABASE_URL);

    } catch (error) {

      console.warn("[Database] Failed to connect:", error);

      _db = null;

    }

  }

  return _db;

}



// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {

  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();

  if (!db) return;



  const values: InsertUser = { openId: user.openId };

  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;

  type TextField = (typeof textFields)[number];



  const assignNullable = (field: TextField) => {

    const value = user[field];

    if (value === undefined) return;

    const normalized = value ?? null;

    values[field] = normalized;

    updateSet[field] = normalized;

  };

  textFields.forEach(assignNullable);



  if (user.lastSignedIn !== undefined) {

    values.lastSignedIn = user.lastSignedIn;

    updateSet.lastSignedIn = user.lastSignedIn;

  }

  if (user.role !== undefined) {

    values.role = user.role;

    updateSet.role = user.role;

  } else if (user.openId === ENV.ownerOpenId) {

    values.role = "admin";

    updateSet.role = "admin";

  }



  if (!values.lastSignedIn) values.lastSignedIn = new Date();

  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();



  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });

}



export async function getUserByOpenId(openId: string) {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result[0];

}



// ─── Corporate Emails ─────────────────────────────────────────────────────────

export async function getCorporateEmailByEmail(email: string) {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db

    .select()

    .from(corporateEmails)

    .where(and(eq(corporateEmails.email, email.toLowerCase()), eq(corporateEmails.isActive, true)))

    .limit(1);

  return result[0];

}



export async function setCorporateEmailPassword(email: string, passwordHash: string, userId: number) {

  const db = await getDb();

  if (!db) return;

  await db

    .update(corporateEmails)

    .set({ passwordHash, hasSetPassword: true, userId, lastAccessAt: new Date() })

    .where(eq(corporateEmails.email, email.toLowerCase()));

}



export async function updateCorporateEmailLastAccess(email: string) {

  const db = await getDb();

  if (!db) return;

  await db

    .update(corporateEmails)

    .set({ lastAccessAt: new Date() })

    .where(eq(corporateEmails.email, email.toLowerCase()));

}



export async function bulkInsertCorporateEmails(emails: InsertCorporateEmail[]) {

  const db = await getDb();

  if (!db) return 0;

  let inserted = 0;

  for (const e of emails) {

    try {

      await db

        .insert(corporateEmails)

        .values({ ...e, email: e.email.toLowerCase() })

        .onDuplicateKeyUpdate({ set: { company: e.company, sector: e.sector, employeeName: e.employeeName, isActive: true } });

      inserted++;

    } catch {

      // skip duplicates

    }

  }

  return inserted;

}



export async function listCorporateEmails(page = 1, limit = 50) {

  const db = await getDb();

  if (!db) return { data: [], total: 0 };

  const offset = (page - 1) * limit;

  const data = await db

    .select()

    .from(corporateEmails)

    .orderBy(desc(corporateEmails.importedAt))

    .limit(limit)

    .offset(offset);

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(corporateEmails);

  return { data, total: countResult[0]?.count ?? 0 };

}



// ─── Modules ─────────────────────────────────────────────────────────────────

export async function listModules() {

  const db = await getDb();

  if (!db) return [];

  // Only return active + published courses to collaborators
  return db.select().from(modules)
    .where(and(
      eq(modules.isActive, true),
      sql`\`modules\`.\`publish_status\` = 'published'`
    ))
    .orderBy(modules.orderIndex);

}

export async function listModulesAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modules).orderBy(modules.orderIndex);
}



export async function getModuleById(id: number) {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db.select().from(modules).where(eq(modules.id, id)).limit(1);

  return result[0];

}



export async function updateModule(id: number, data: Partial<typeof modules.$inferInsert>) {

  const db = await getDb();

  if (!db) return;

  await db.update(modules).set(data).where(eq(modules.id, id));

}



// ─── User Progress ────────────────────────────────────────────────────────────

export async function getUserProgress(userId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(userProgress).where(eq(userProgress.userId, userId));

}



export async function getUserProgressForModule(userId: number, moduleId: number) {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db

    .select()

    .from(userProgress)

    .where(and(eq(userProgress.userId, userId), eq(userProgress.moduleId, moduleId)))

    .limit(1);

  return result[0];

}



export async function upsertUserProgress(

  userId: number,

  moduleId: number,

  percentWatched: number,

  isCompleted: boolean

) {

  const db = await getDb();

  if (!db) return;

  const existing = await getUserProgressForModule(userId, moduleId);

  const completedAt = isCompleted && !existing?.isCompleted ? new Date() : existing?.completedAt;



  if (existing) {

    await db

      .update(userProgress)

      .set({ percentWatched, isCompleted, completedAt, lastWatchedAt: new Date() })

      .where(and(eq(userProgress.userId, userId), eq(userProgress.moduleId, moduleId)));

  } else {

    await db.insert(userProgress).values({

      userId,

      moduleId,

      percentWatched,

      isCompleted,

      completedAt,

      lastWatchedAt: new Date(),

    });

  }

}



// ─── Certificates ─────────────────────────────────────────────────────────────

export async function getCertificate(userId: number, moduleId: number) {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db

    .select()

    .from(certificates)

    .where(and(eq(certificates.userId, userId), eq(certificates.moduleId, moduleId)))

    .limit(1);

  return result[0];

}



export async function getUserCertificates(userId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(certificates).where(eq(certificates.userId, userId)).orderBy(desc(certificates.issuedAt));

}



export async function createCertificate(userId: number, moduleId: number, code: string, pdfUrl?: string) {

  const db = await getDb();

  if (!db) return undefined;

  await db.insert(certificates).values({ userId, moduleId, certificateCode: code, pdfUrl });

  const result = await db

    .select()

    .from(certificates)

    .where(eq(certificates.certificateCode, code))

    .limit(1);

  return result[0];

}



// ─── Decompression Videos ─────────────────────────────────────────────────────

export async function listDecompressionVideos() {

  const db = await getDb();

  if (!db) return [];

  return db

    .select()

    .from(decompressionVideos)

    .where(eq(decompressionVideos.isActive, true))

    .orderBy(decompressionVideos.orderIndex);

}



// ─── Reminder Settings ────────────────────────────────────────────────────────

export async function getReminderSettings() {

  const db = await getDb();

  if (!db) return undefined;

  const result = await db.select().from(reminderSettings).limit(1);

  return result[0];

}



export async function updateReminderSettings(data: Partial<typeof reminderSettings.$inferInsert>) {

  const db = await getDb();

  if (!db) return;

  const existing = await getReminderSettings();

  if (existing) {

    await db.update(reminderSettings).set(data).where(eq(reminderSettings.id, existing.id));

  } else {

    await db.insert(reminderSettings).values({ inactiveDaysThreshold: 7, lowEngagementThreshold: 30, isEnabled: true, ...data });

  }

}



// ─── Admin Reports ────────────────────────────────────────────────────────────

export async function getAdminStats() {

  const db = await getDb();

  if (!db) return null;



  const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(corporateEmails).where(eq(corporateEmails.isActive, true));

  const activeUsers = await db.select({ count: sql<number>`count(*)` }).from(corporateEmails).where(and(eq(corporateEmails.isActive, true), eq(corporateEmails.hasSetPassword, true)));

  const totalCerts = await db.select({ count: sql<number>`count(*)` }).from(certificates);

  const totalProgress = await db.select({ count: sql<number>`count(*)` }).from(userProgress).where(eq(userProgress.isCompleted, true));



  return {

    totalUsers: totalUsers[0]?.count ?? 0,

    activeUsers: activeUsers[0]?.count ?? 0,

    totalCertificates: totalCerts[0]?.count ?? 0,

    completedModules: totalProgress[0]?.count ?? 0,

  };

}



export async function getSectorEngagement() {

  const db = await getDb();

  if (!db) return [];

  const result = await db

    .select({

      sector: corporateEmails.sector,

      total: sql<number>`count(*)`,

      active: sql<number>`sum(case when ${corporateEmails.hasSetPassword} = 1 then 1 else 0 end)`,

    })

    .from(corporateEmails)

    .where(eq(corporateEmails.isActive, true))

    .groupBy(corporateEmails.sector);

  return result;

}



export async function getInactiveUsers(daysThreshold: number) {

  const db = await getDb();

  if (!db) return [];

  const cutoff = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

  return db

    .select()

    .from(corporateEmails)

    .where(

      and(

        eq(corporateEmails.isActive, true),

        eq(corporateEmails.hasSetPassword, true),

        or(isNull(corporateEmails.lastAccessAt), lt(corporateEmails.lastAccessAt, cutoff))

      )

    );

}



// ─── Email Logs ───────────────────────────────────────────────────────────────

export async function logEmail(

  recipientEmail: string,

  type: "reminder_employee" | "alert_rh" | "welcome",

  subject: string,

  success: boolean,

  errorMessage?: string

) {

  const db = await getDb();

  if (!db) return;

  await db.insert(emailLogs).values({ recipientEmail, type, subject, success, errorMessage });

}



export async function getEmailLogs(limit = 50) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt)).limit(limit);

}



// ─── Decompression Videos CRUD ────────────────────────────────────────────────

export async function listAllDecompressionVideos() {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(decompressionVideos).orderBy(decompressionVideos.orderIndex);

}



export async function createDecompressionVideo(data: {

  title: string;

  category: "yoga" | "meditacao" | "respiracao" | "outro";

  videoUrl?: string;

  thumbnailUrl?: string;

  durationMinutes?: number;

  description?: string;

  isActive?: boolean;

  orderIndex?: number;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result = await db.insert(decompressionVideos).values({

    title: data.title,

    category: data.category,

    videoUrl: data.videoUrl,

    thumbnailUrl: data.thumbnailUrl,

    durationMinutes: data.durationMinutes ?? 0,

    description: data.description,

    isActive: data.isActive ?? true,

    orderIndex: data.orderIndex ?? 0,

  });

  return result;

}



export async function updateDecompressionVideo(id: number, data: Partial<{

  title: string;

  category: "yoga" | "meditacao" | "respiracao" | "outro";

  videoUrl: string;

  thumbnailUrl: string;

  durationMinutes: number;

  description: string;

  isActive: boolean;

  orderIndex: number;

}>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(decompressionVideos).set(data).where(eq(decompressionVideos.id, id));

}



export async function deleteDecompressionVideo(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(decompressionVideos).where(eq(decompressionVideos.id, id));

}



// ─── Module Certificate Config ────────────────────────────────────────────────

export async function updateModuleCertConfig(moduleId: number, data: {

  certTitle?: string;

  certBody?: string;

  certSignerName?: string;

  certSignerRole?: string;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(modules).set(data).where(eq(modules.id, moduleId));

}



// ─── Lessons CRUD ─────────────────────────────────────────────────────────────

import {

  lessons,

  lessonProgress,

  quizzes,

  quizQuestions,

  quizOptions,

  quizAttempts,

  auditLogs,

  lessonViewEvents,

  courseAcceptanceTerms,

} from "../drizzle/schema";



// ─── Quizzes ─────────────────────────────────────────────────────────────────

export async function getQuizByLesson(lessonId: number) {

  const db = await getDb();

  if (!db) return null;

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).limit(1);

  if (!quiz) return null;

  const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, quiz.id)).orderBy(quizQuestions.orderIndex);

  const questionsWithOptions = await Promise.all(

    qs.map(async (q) => {

      const options = await db.select().from(quizOptions).where(eq(quizOptions.questionId, q.id)).orderBy(quizOptions.orderIndex);

      return { ...q, options };

    })

  );

  return { ...quiz, questions: questionsWithOptions };

}



export async function getQuizForGrading(lessonId: number) {

  return getQuizByLesson(lessonId);

}



export async function createQuizAttempt(data: {

  userId: number; quizId: number; lessonId: number; score: number; passed: number; answersJson: string; ipAddress?: string; userAgent?: string;

}) {

  const db = await getDb();

  if (!db) return;

  await db.insert(quizAttempts).values({ ...data, completedAt: new Date() });

}



export async function getUserQuizAttempts(userId: number, quizId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(quizAttempts)

    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId)))

    .orderBy(desc(quizAttempts.startedAt));

}



export async function getLatestPassedAttempt(userId: number, quizId: number) {

  const db = await getDb();

  if (!db) return null;

  const [a] = await db.select().from(quizAttempts)

    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId), eq(quizAttempts.passed, 1)))

    .limit(1);

  return a ?? null;

}



export async function upsertQuiz(lessonId: number, passingScore: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const existing = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).limit(1);

  if (existing[0]) {

    await db.update(quizzes).set({ passingScore }).where(eq(quizzes.id, existing[0].id));

    return existing[0].id;

  }

  const result: any = await db.insert(quizzes).values({ lessonId, passingScore });

  const insertId = Number(result?.[0]?.insertId ?? result?.insertId);

  if (insertId) return insertId;

  const after = await db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).limit(1);

  return after[0]!.id;

}



export async function createQuestion(quizId: number, questionText: string, orderIndex: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(quizQuestions).values({ quizId, questionText, orderIndex });

  const insertId = Number(result?.[0]?.insertId ?? result?.insertId);

  return insertId;

}



export async function createOption(questionId: number, optionText: string, isCorrect: number, orderIndex: number) {

  const db = await getDb();

  if (!db) return;

  await db.insert(quizOptions).values({ questionId, optionText, isCorrect, orderIndex });

}



export async function deleteQuestion(id: number) {

  const db = await getDb();

  if (!db) return;

  await db.delete(quizOptions).where(eq(quizOptions.questionId, id));

  await db.delete(quizQuestions).where(eq(quizQuestions.id, id));

}



// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function logAudit(data: {

  userId?: number | null; userEmail?: string | null; action: string;

  entityType?: string; entityId?: number; detailsJson?: any;

  ipAddress?: string; userAgent?: string;

}) {

  try {

    const db = await getDb();

    if (!db) return;

    await db.insert(auditLogs).values({

      userId: data.userId ?? null,

      userEmail: data.userEmail ?? null,

      action: data.action,

      entityType: data.entityType,

      entityId: data.entityId,

      detailsJson: data.detailsJson ? JSON.stringify(data.detailsJson) : null,

      ipAddress: data.ipAddress,

      userAgent: data.userAgent,

    });

  } catch (e) {

    console.warn("[audit] log failed:", e);

  }

}



export async function listAuditLogs(filters: { userId?: number; action?: string; limit?: number } = {}) {

  const db = await getDb();

  if (!db) return [];

  const conds: any[] = [];

  if (filters.userId) conds.push(eq(auditLogs.userId, filters.userId));

  if (filters.action) conds.push(eq(auditLogs.action, filters.action));

  const q = conds.length

    ? db.select().from(auditLogs).where(and(...conds))

    : db.select().from(auditLogs);

  return q.orderBy(desc(auditLogs.createdAt)).limit(filters.limit ?? 200);

}



// ─── Lesson view events ──────────────────────────────────────────────────────

export async function logViewEvent(data: {

  userId: number; lessonId: number; moduleId: number;

  videoPositionSeconds: number; videoDurationSeconds: number;

  eventType: string; ipAddress?: string;

}) {

  try {

    const db = await getDb();

    if (!db) return;

    await db.insert(lessonViewEvents).values(data);

  } catch (e) {

    console.warn("[view-event] log failed:", e);

  }

}



export async function getViewEventsByUserLesson(userId: number, lessonId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(lessonViewEvents)

    .where(and(eq(lessonViewEvents.userId, userId), eq(lessonViewEvents.lessonId, lessonId)))

    .orderBy(lessonViewEvents.createdAt);

}



export async function getEffectiveWatchSeconds(userId: number, lessonId: number) {

  const events = await getViewEventsByUserLesson(userId, lessonId);

  if (events.length < 2) return 0;

  let total = 0;

  for (let i = 1; i < events.length; i++) {

    const prev = events[i - 1];

    const curr = events[i];

    const prevTs = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;

    const currTs = curr.createdAt ? new Date(curr.createdAt).getTime() : 0;

    const deltaTime = (currTs - prevTs) / 1000;

    const deltaPos = (curr.videoPositionSeconds ?? 0) - (prev.videoPositionSeconds ?? 0);

    if (deltaTime > 0 && deltaTime < 20 && deltaPos >= 0 && deltaPos < deltaTime * 2) {

      total += Math.min(deltaTime, deltaPos + 1);

    }

  }

  return Math.round(total);

}



// ─── Course acceptance terms ─────────────────────────────────────────────────

export async function recordAcceptance(data: {

  userId: number; moduleId: number; termText: string;

  userName?: string | null; userEmail?: string | null;

  ipAddress?: string; userAgent?: string;

}) {

  try {

    const db = await getDb();

    if (!db) return;

    await db.insert(courseAcceptanceTerms).values({

      userId: data.userId, moduleId: data.moduleId, termText: data.termText,

      userNameAtAcceptance: data.userName ?? undefined,

      userEmailAtAcceptance: data.userEmail ?? undefined,

      ipAddress: data.ipAddress, userAgent: data.userAgent,

    });

  } catch { /* duplicate ignored */ }

}



export async function getAcceptance(userId: number, moduleId: number) {

  const db = await getDb();

  if (!db) return null;

  const [a] = await db.select().from(courseAcceptanceTerms)

    .where(and(eq(courseAcceptanceTerms.userId, userId), eq(courseAcceptanceTerms.moduleId, moduleId)))

    .limit(1);

  return a ?? null;

}



// ─── Users (helpers) ─────────────────────────────────────────────────────────

export async function getUserById(userId: number) {

  const db = await getDb();

  if (!db) return null;

  const r = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return r[0] ?? null;

}



// ─── Evidence report ─────────────────────────────────────────────────────────

export async function getEvidenceReport(userId: number) {

  const db = await getDb();

  if (!db) return null;

  const user = await getUserById(userId);

  const certs = await db.select().from(certificates).where(eq(certificates.userId, userId));

  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.userId, userId)).orderBy(desc(quizAttempts.startedAt));

  const acceptances = await db.select().from(courseAcceptanceTerms).where(eq(courseAcceptanceTerms.userId, userId));

  const auditTrail = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(500);

  return { user, certs, attempts, acceptances, auditTrail };

}



// Cert lookup by code (for public verification)

export async function getCertificateByCode(code: string) {

  const db = await getDb();

  if (!db) return null;

  const r = await db.select().from(certificates).where(eq(certificates.certificateCode, code)).limit(1);

  return r[0] ?? null;

}



export async function listLessonsByModule(moduleId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(lessons)

    .where(and(eq(lessons.moduleId, moduleId), eq(lessons.isActive, true)))

    .orderBy(lessons.orderIndex);

}



export async function listAllLessonsByModule(moduleId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(lessons)

    .where(eq(lessons.moduleId, moduleId))

    .orderBy(lessons.orderIndex);

}



export async function createLesson(data: {

  moduleId: number;

  title: string;

  description?: string;

  videoUrl?: string;

  durationMinutes?: number;

  orderIndex?: number;

  isActive?: boolean;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.insert(lessons).values({

    moduleId: data.moduleId,

    title: data.title,

    description: data.description,

    videoUrl: data.videoUrl,

    durationMinutes: data.durationMinutes ?? 0,

    orderIndex: data.orderIndex ?? 0,

    isActive: data.isActive ?? true,

  });

}



export async function updateLesson(id: number, data: Partial<{

  title: string;

  description: string;

  videoUrl: string;

  durationMinutes: number;

  orderIndex: number;

  isActive: boolean;

}>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(lessons).set(data).where(eq(lessons.id, id));

}



export async function deleteLesson(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(lessons).where(eq(lessons.id, id));

}



export async function getLessonProgress(userId: number, lessonId: number) {

  const db = await getDb();

  if (!db) return null;

  const result = await db.select().from(lessonProgress)

    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))

    .limit(1);

  return result[0] ?? null;

}



export async function upsertLessonProgress(userId: number, lessonId: number, moduleId: number, data: {

  percentWatched?: number;

  isCompleted?: boolean;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const existing = await getLessonProgress(userId, lessonId);

  if (existing) {

    const updateData: Record<string, unknown> = { lastWatchedAt: new Date() };

    if (data.percentWatched !== undefined) updateData.percentWatched = data.percentWatched;

    if (data.isCompleted !== undefined) {

      updateData.isCompleted = data.isCompleted;

      if (data.isCompleted) updateData.completedAt = new Date();

    }

    await db.update(lessonProgress).set(updateData).where(eq(lessonProgress.id, existing.id));

  } else {

    await db.insert(lessonProgress).values({

      userId,

      lessonId,

      moduleId,

      percentWatched: data.percentWatched ?? 0,

      isCompleted: data.isCompleted ?? false,

      completedAt: data.isCompleted ? new Date() : undefined,

    });

  }

}



export async function getModuleLessonProgressForUser(userId: number, moduleId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(lessonProgress)

    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.moduleId, moduleId)));

}



// ─── Module CRUD (admin) ──────────────────────────────────────────────────────

export async function createModule(data: {

  title: string;

  description?: string;

  durationMinutes?: number;

  orderIndex?: number;

  isActive?: boolean;

  publishStatus?: string;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.insert(modules).values({

    title: data.title,

    description: data.description,

    durationMinutes: data.durationMinutes ?? 0,

    orderIndex: data.orderIndex ?? 0,

    isActive: data.isActive ?? true,

    publishStatus: data.publishStatus ?? "published",

  });

}



export async function adminUpdateModule(id: number, data: Partial<{

  title: string;

  description: string;

  durationMinutes: number;

  orderIndex: number;

  isActive: boolean;

  certTitle: string;

  certBody: string;

  certSignerName: string;

  certSignerRole: string;

}>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(modules).set(data).where(eq(modules.id, id));

}



export async function deleteModule(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(lessons).where(eq(lessons.moduleId, id));

  await db.delete(lessonProgress).where(eq(lessonProgress.moduleId, id));

  await db.delete(modules).where(eq(modules.id, id));

}



// ── COMPANIES ──

export async function getCompanies() {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(companies).orderBy(companies.name);

}



export async function getCompanyById(id: number) {

  const db = await getDb();

  if (!db) return null;

  const rows = await db.select().from(companies).where(eq(companies.id, id)).limit(1);

  return rows[0] ?? null;

}



export async function createCompany(data: { name: string; cnpj?: string }) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result = await db.insert(companies).values(data);

  return result[0];

}



export async function updateCompany(id: number, data: Partial<{ name: string; cnpj: string; isActive: number }>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(companies).set(data).where(eq(companies.id, id));

}



// ── BRANCHES ──

export async function getBranchesByCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(branches).where(eq(branches.companyId, companyId)).orderBy(branches.name);

}



export async function createBranch(data: { companyId: number; name: string; city?: string; state?: string }) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result = await db.insert(branches).values(data);

  return result[0];

}



export async function updateBranch(id: number, data: Partial<{ name: string; city: string; state: string; isActive: number }>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(branches).set(data).where(eq(branches.id, id));

}



export async function deleteBranch(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(branches).where(eq(branches.id, id));

}



// ── SECTORS ──

export async function getSectorsByCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(sectors).where(eq(sectors.companyId, companyId)).orderBy(sectors.name);

}



export async function getSectorsByBranch(branchId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(sectors).where(eq(sectors.branchId, branchId)).orderBy(sectors.name);

}



export async function createSector(data: { companyId: number; branchId?: number; name: string }) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result = await db.insert(sectors).values(data);

  return result[0];

}



export async function updateSector(id: number, data: Partial<{ name: string; isActive: number }>) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(sectors).set(data).where(eq(sectors.id, id));

}



export async function deleteSector(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(sectors).where(eq(sectors.id, id));

}



// ── USERS filtered by company ──

export async function getUsersByCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(users).where(eq(users.companyId, companyId));

}



export async function getCorporateEmailsByCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(corporateEmails).where(eq(corporateEmails.companyId, companyId));

}



// ── SECTOR ENGAGEMENT filtered by company ──

export async function getSectorEngagementByCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  const rows = await db

    .select({

      sector: corporateEmails.sector,

      total: sql<number>`COUNT(*)`,

      active: sql<number>`SUM(CASE WHEN ${corporateEmails.isActive}=1 THEN 1 ELSE 0 END)`,

      completed: sql<number>`SUM(CASE WHEN ${corporateEmails.hasSetPassword}=1 THEN 1 ELSE 0 END)`,

    })

    .from(corporateEmails)

    .where(eq(corporateEmails.companyId, companyId))

    .groupBy(corporateEmails.sector);

  return rows;

}



// ─── Gamification ─────────────────────────────────────────────────────────────

export async function awardPoints(userId: number, points: number, reason: string, entityType?: string, entityId?: number) {

  const db = await getDb();

  if (!db) return;

  await db.insert(userPoints).values({ userId, points, reason, entityType, entityId });

}



export async function getUserTotalPoints(userId: number): Promise<number> {

  const db = await getDb();

  if (!db) return 0;

  const result = await db.select({ total: sql<number>`COALESCE(SUM(points),0)` }).from(userPoints).where(eq(userPoints.userId, userId));

  return Number(result[0]?.total ?? 0);

}



export async function getLeaderboard(limit = 10) {

  const db = await getDb();

  if (!db) return [];

  const rows = await db.select({

    userId: userPoints.userId,

    total: sql<number>`SUM(points)`,

  }).from(userPoints).groupBy(userPoints.userId).orderBy(sql`SUM(points) DESC`).limit(limit);

  return rows;

}



export async function getUserBadges(userId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(userBadges).where(eq(userBadges.userId, userId));

}



export async function awardBadge(userId: number, badgeKey: string, badgeName: string, badgeIcon: string) {

  const db = await getDb();

  if (!db) return;

  try {

    await db.insert(userBadges).values({ userId, badgeKey, badgeName, badgeIcon });

  } catch {

    // duplicate — already has badge

  }

}



// ─── Company white-label ──────────────────────────────────────────────────────

export async function getCompanySettings(companyId: number) {

  const db = await getDb();

  if (!db) return null;

  const result = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);

  return result[0] ?? null;

}



export async function updateCompanySettings(companyId: number, data: {

  primaryColor?: string; description?: string; phone?: string;

  website?: string; address?: string; loginBgUrl?: string; logoUrl?: string; name?: string;

}) {

  const db = await getDb();

  if (!db) return;

  await db.update(companies).set(data as any).where(eq(companies.id, companyId));

}



// ─── Certificate Expiration & Compliance ─────────────────────────────────────

export function computeCertStatus(expiresAt: Date | null | undefined): 'valid' | 'expiring_soon' | 'expired' | 'no_expiry' {

  if (!expiresAt) return 'no_expiry';

  const now = Date.now();

  const exp = new Date(expiresAt).getTime();

  if (exp < now) return 'expired';

  const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (days <= 30) return 'expiring_soon';

  return 'valid';

}



export async function getCompanyCertExpirations(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  // Join certs -> users -> corporateEmails (via email match) for company filter

  const rows = await db

    .select({

      certId: certificates.id,

      userId: certificates.userId,

      moduleId: certificates.moduleId,

      issuedAt: certificates.issuedAt,

      expiresAt: certificates.expiresAt,

      moduleTitle: modules.title,

      isMandatory: modules.isMandatory,

      profession: modules.profession,

      userName: users.name,

      userEmail: users.email,

      userCompanyId: users.companyId,

    })

    .from(certificates)

    .leftJoin(modules, eq(certificates.moduleId, modules.id))

    .leftJoin(users, eq(certificates.userId, users.id))

    .where(eq(users.companyId, companyId));

  return rows

    .map(r => ({ ...r, status: computeCertStatus(r.expiresAt as any) }))

    .sort((a, b) => {

      const ax = a.expiresAt ? new Date(a.expiresAt as any).getTime() : Number.MAX_SAFE_INTEGER;

      const bx = b.expiresAt ? new Date(b.expiresAt as any).getTime() : Number.MAX_SAFE_INTEGER;

      return ax - bx;

    });

}



export async function getUserCertExpirations(userId: number) {

  const db = await getDb();

  if (!db) return [];

  const rows = await db

    .select({

      certId: certificates.id,

      moduleId: certificates.moduleId,

      issuedAt: certificates.issuedAt,

      expiresAt: certificates.expiresAt,

      moduleTitle: modules.title,

      validityDays: modules.validityDays,

    })

    .from(certificates)

    .leftJoin(modules, eq(certificates.moduleId, modules.id))

    .where(eq(certificates.userId, userId));

  return rows

    .map(r => ({ ...r, status: computeCertStatus(r.expiresAt as any) }))

    .sort((a, b) => {

      const ax = a.expiresAt ? new Date(a.expiresAt as any).getTime() : Number.MAX_SAFE_INTEGER;

      const bx = b.expiresAt ? new Date(b.expiresAt as any).getTime() : Number.MAX_SAFE_INTEGER;

      return ax - bx;

    });

}



// ─── Professional Licenses ───────────────────────────────────────────────────

export async function listProfessionalLicenses(userId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(professionalLicenses).where(eq(professionalLicenses.userId, userId)).orderBy(professionalLicenses.expiresAt);

}



export async function createProfessionalLicense(data: InsertProfessionalLicense) {

  const db = await getDb();

  if (!db) return null;

  await db.insert(professionalLicenses).values(data);

  return { ok: true };

}



export async function updateProfessionalLicense(id: number, data: Partial<InsertProfessionalLicense>) {

  const db = await getDb();

  if (!db) return;

  await db.update(professionalLicenses).set(data as any).where(eq(professionalLicenses.id, id));

}



export async function deleteProfessionalLicense(id: number) {

  const db = await getDb();

  if (!db) return;

  await db.delete(professionalLicenses).where(eq(professionalLicenses.id, id));

}



export async function getCompanyLicenseExpirations(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  const rows = await db

    .select({

      id: professionalLicenses.id,

      userId: professionalLicenses.userId,

      licenseType: professionalLicenses.licenseType,

      licenseNumber: professionalLicenses.licenseNumber,

      issuedAt: professionalLicenses.issuedAt,

      expiresAt: professionalLicenses.expiresAt,

      userName: users.name,

      userEmail: users.email,

      userCompanyId: users.companyId,

    })

    .from(professionalLicenses)

    .leftJoin(users, eq(professionalLicenses.userId, users.id))

    .where(eq(users.companyId, companyId));

  return rows.map(r => ({ ...r, status: computeCertStatus(r.expiresAt as any) }));

}



// ─── Dashboards ──────────────────────────────────────────────────────────────

export async function getManagerDashboard(companyId: number | null) {

  const db = await getDb();

  if (!db) return null;

  const now = new Date();

  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);



  // Total active employees in company (corporate_emails)

  const empWhere = companyId

    ? and(eq(corporateEmails.isActive, true), eq(corporateEmails.companyId, companyId))

    : eq(corporateEmails.isActive, true);

  const empCount = await db.select({ count: sql<number>`count(*)` }).from(corporateEmails).where(empWhere);

  const totalEmployees = Number(empCount[0]?.count ?? 0);



  // Active trainings = modules.isActive

  const modCount = await db.select({ count: sql<number>`count(*)` }).from(modules).where(eq(modules.isActive, true));

  const activeTrainings = Number(modCount[0]?.count ?? 0);



  // Certs expiring or expired (filtered to company if provided)

  const certsRows = companyId ? await getCompanyCertExpirations(companyId) : [];

  const certsExpiring30d = certsRows.filter(r => r.status === 'expiring_soon').length;

  const certsExpired = certsRows.filter(r => r.status === 'expired').length;



  // Mandatory compliance rate: for each mandatory module, % of employees with a valid (non-expired) certificate

  const mandatoryMods = await db.select().from(modules).where(eq(modules.isMandatory, true));

  let mandatoryComplianceRate = 100;

  if (mandatoryMods.length > 0 && totalEmployees > 0) {

    let totalValid = 0;

    let totalNeeded = 0;

    for (const m of mandatoryMods) {

      const validCertsQuery = companyId

        ? await db

            .select({ count: sql<number>`count(distinct ${certificates.userId})` })

            .from(certificates)

            .leftJoin(users, eq(certificates.userId, users.id))

            .where(and(

              eq(certificates.moduleId, m.id),

              eq(users.companyId, companyId),

              or(isNull(certificates.expiresAt), sql`${certificates.expiresAt} > NOW()`)!

            ))

        : await db

            .select({ count: sql<number>`count(distinct ${certificates.userId})` })

            .from(certificates)

            .where(and(eq(certificates.moduleId, m.id), or(isNull(certificates.expiresAt), sql`${certificates.expiresAt} > NOW()`)!));

      totalValid += Number(validCertsQuery[0]?.count ?? 0);

      totalNeeded += totalEmployees;

    }

    mandatoryComplianceRate = totalNeeded > 0 ? Math.round((totalValid / totalNeeded) * 100) : 100;

  }



  return {

    totalEmployees,

    activeTrainings,

    certsExpiring30d,

    certsExpired,

    mandatoryComplianceRate,

    upcomingExpirations: certsRows.slice(0, 5),

  };

}



export async function getEmployeeDashboard(userId: number) {

  const db = await getDb();

  if (!db) return null;

  // Last accessed lesson

  const last = await db

    .select()

    .from(lessonProgress)

    .where(eq(lessonProgress.userId, userId))

    .orderBy(desc(lessonProgress.lastWatchedAt))

    .limit(1);

  let nextLesson: any = null;

  if (last[0]) {

    const lesson = await db.select().from(lessons).where(eq(lessons.id, last[0].lessonId)).limit(1);

    nextLesson = lesson[0] ? { ...lesson[0], percentWatched: last[0].percentWatched } : null;

  }

  const myCerts = await getUserCertExpirations(userId);

  const myCertsExpiring = myCerts.filter(c => c.status === 'expiring_soon' || c.status === 'expired');

  // Gamification points

  const pts = await db

    .select({ total: sql<number>`COALESCE(SUM(${userPoints.points}), 0)` })

    .from(userPoints)

    .where(eq(userPoints.userId, userId));

  const gamificationPoints = Number(pts[0]?.total ?? 0);



  return {

    nextLesson,

    myCertsExpiring,

    gamificationPoints,

  };

}



// ─── Learning Trails ─────────────────────────────────────────────────────────

export async function listLearningTrails() {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(learningTrails).where(eq(learningTrails.isActive, 1)).orderBy(learningTrails.id);

}



export async function listAllLearningTrails() {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(learningTrails).orderBy(learningTrails.id);

}



export async function getLearningTrailById(id: number) {

  const db = await getDb();

  if (!db) return null;

  const result = await db.select().from(learningTrails).where(eq(learningTrails.id, id)).limit(1);

  return result[0] ?? null;

}



export async function createLearningTrail(data: { title: string; description?: string; objective?: string; thumbnailUrl?: string; isSequential?: number }) {

  const db = await getDb();

  if (!db) return null;

  const [result] = await db.insert(learningTrails).values({ title: data.title, description: data.description, objective: data.objective, thumbnailUrl: data.thumbnailUrl, isSequential: data.isSequential ?? 0 }).$returningId();

  return result;

}



export async function updateLearningTrail(id: number, data: Partial<{ title: string; description: string; objective: string; thumbnailUrl: string; isSequential: number; isActive: number }>) {

  const db = await getDb();

  if (!db) return;

  await db.update(learningTrails).set(data as any).where(eq(learningTrails.id, id));

}



export async function deleteLearningTrail(id: number) {

  const db = await getDb();

  if (!db) return;

  await db.delete(trailModulesTable).where(eq(trailModulesTable.trailId, id));

  await db.delete(learningTrails).where(eq(learningTrails.id, id));

}



export async function getTrailModules(trailId: number) {

  const db = await getDb();

  if (!db) return [];

  return db.select().from(trailModulesTable).where(eq(trailModulesTable.trailId, trailId)).orderBy(trailModulesTable.orderIndex);

}



export async function addModuleToTrail(

  trailId: number,

  moduleId: number | null,

  orderIndex: number,

  opts?: { itemType?: string; quizConfig?: any; surveyId?: number | null }

) {

  const db = await getDb();

  if (!db) return;

  try {

    await db.insert(trailModulesTable).values({

      trailId,

      moduleId: moduleId ?? null as any,

      orderIndex,

      itemType: (opts?.itemType ?? "module") as any,

      quizConfig: (opts?.quizConfig ?? null) as any,

      surveyId: (opts?.surveyId ?? null) as any,

    } as any);

  } catch { /* duplicate */ }

}



export async function removeTrailItem(trailItemId: number) {

  const db = await getDb();

  if (!db) return;

  await db.delete(trailModulesTable).where(eq(trailModulesTable.id, trailItemId));

}



export async function getCompanyNameById(companyId: number): Promise<string | null> {

  const db = await getDb();

  if (!db) return null;

  const r = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);

  return r[0]?.name ?? null;

}



export async function getImpersonationContext(companyId: number): Promise<{ companyName: string | null; adminName: string | null; adminEmail: string | null }> {

  const db = await getDb();

  if (!db) return { companyName: null, adminName: null, adminEmail: null };

  const cr = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1);

  const companyName = cr[0]?.name ?? null;

  // Find an admin user for this company (prefer admin/rh/company_admin/admin_global roles)

  const ur = await db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.companyId, companyId));

  const adminRoles = ["admin","rh","company_admin","admin_global"];

  const admin = ur.find(u => adminRoles.includes(u.role ?? "")) ?? ur[0] ?? null;

  return { companyName, adminName: admin?.name ?? null, adminEmail: admin?.email ?? null };

}



export async function removeModuleFromTrail(trailId: number, moduleId: number) {

  const db = await getDb();

  if (!db) return;

  await db.delete(trailModulesTable).where(and(eq(trailModulesTable.trailId, trailId), eq(trailModulesTable.moduleId, moduleId)));

}



export async function getTrailProgress(userId: number, trailId: number) {

  const db = await getDb();

  if (!db) return { total: 0, completed: 0, pct: 0 };

  const mods = await db.select().from(trailModulesTable).where(eq(trailModulesTable.trailId, trailId));

  if (mods.length === 0) return { total: 0, completed: 0, pct: 0 };

  const completed = await db.select({ count: sql<number>`COUNT(*)` }).from(userProgress).where(and(eq(userProgress.userId, userId), eq(userProgress.isCompleted, true))).then(r => Number(r[0]?.count ?? 0));

  const moduleIds = mods.map(m => m.moduleId);

  let completedInTrail = 0;

  for (const mid of moduleIds) {

    if (mid == null) continue;

    const p = await db.select().from(userProgress).where(and(eq(userProgress.userId, userId), eq(userProgress.moduleId, mid))).limit(1);

    if (p[0]?.isCompleted) completedInTrail++;

  }

  return { total: mods.length, completed: completedInTrail, pct: Math.round((completedInTrail / mods.length) * 100) };

}





// ════════════════════════════════════════════════════════════════════════════

// SAUDE DO TRABALHO — Super Admin / Multi-tenant / Catalog additions

// ════════════════════════════════════════════════════════════════════════════

import {

  companyContentEnrollments,

  lessons as _lessonsTbl,

} from "../drizzle/schema";

const _learningTrails = learningTrails;

const _trailModules = trailModulesTable;



// ─── Super Admin / Companies ─────────────────────────────────────────────────

export async function listAllCompaniesWithStats() {

  const db = await getDb();

  if (!db) return [];

  const all = await db.select().from(companies).orderBy(companies.name);

  const result: any[] = [];

  for (const c of all) {

    const emp = await db

      .select({ n: sql<number>`COUNT(*)` })

      .from(corporateEmails)

      .where(eq(corporateEmails.companyId, c.id));

    const mods = await db

      .select({ n: sql<number>`COUNT(*)` })

      .from(companyContentEnrollments)

      .where(and(eq(companyContentEnrollments.companyId, c.id), eq(companyContentEnrollments.isActive, 1)));

    result.push({

      ...c,

      employeesCount: Number(emp[0]?.n ?? 0),

      enrolledContentCount: Number(mods[0]?.n ?? 0),

    });

  }

  return result;

}



export async function getSuperAdminOverview() {

  const db = await getDb();

  if (!db) return null;

  const totalCompanies = await db.select({ n: sql<number>`COUNT(*)` }).from(companies);

  const activeCompanies = await db

    .select({ n: sql<number>`COUNT(*)` })

    .from(companies)

    .where(sql`${companies.subscriptionStatus} = 'active'`);

  const totalMrrRow = await db

    .select({ n: sql<number>`COALESCE(SUM(CAST(${companies.mrr} AS DECIMAL(12,2))), 0)` })

    .from(companies);

  const totalEmployees = await db

    .select({ n: sql<number>`COUNT(*)` })

    .from(corporateEmails)

    .where(eq(corporateEmails.isActive, true));

  const canceled30d = await db

    .select({ n: sql<number>`COUNT(*)` })

    .from(companies)

    .where(sql`${companies.subscriptionStatus} = 'canceled'`);

  return {

    totalCompanies: Number(totalCompanies[0]?.n ?? 0),

    activeCompanies: Number(activeCompanies[0]?.n ?? 0),

    totalMrr: Number(totalMrrRow[0]?.n ?? 0),

    totalEmployees: Number(totalEmployees[0]?.n ?? 0),

    churn30d: Number(canceled30d[0]?.n ?? 0),

  };

}



export async function createCompanyFull(data: {

  name: string;

  cnpj?: string;

  plan?: string;

  subscriptionStatus?: string;

  mrr?: number;

  maxEmployees?: number;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const result = await db.insert(companies).values({

    name: data.name,

    cnpj: data.cnpj,

    plan: data.plan ?? 'essencial',

    subscriptionStatus: data.subscriptionStatus ?? 'trial',

    mrr: data.mrr != null ? String(data.mrr) : '0',

    maxEmployees: data.maxEmployees ?? 50,

  } as any);

  return result;

}



export async function updateCompanyPlan(id: number, data: {

  plan?: string; subscriptionStatus?: string; mrr?: number; maxEmployees?: number;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const patch: any = {};

  if (data.plan !== undefined) patch.plan = data.plan;

  if (data.subscriptionStatus !== undefined) patch.subscriptionStatus = data.subscriptionStatus;

  if (data.mrr !== undefined) patch.mrr = String(data.mrr);

  if (data.maxEmployees !== undefined) patch.maxEmployees = data.maxEmployees;

  await db.update(companies).set(patch).where(eq(companies.id, id));

}



export async function deleteCompanyHard(id: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.delete(companies).where(eq(companies.id, id));

}



// ─── Master Catalog ──────────────────────────────────────────────────────────

export async function listMasterCatalog() {

  const db = await getDb();

  if (!db) return { modules: [], trails: [] };

  const mods = await db.select().from(modules).where(eq(modules.isCatalogMaster, true)).orderBy(modules.orderIndex);

  const trails = await db.select().from(_learningTrails).where(eq(_learningTrails.isCatalogMaster, true));

  return { modules: mods, trails };

}



export async function setModuleMasterFlag(moduleId: number, isMaster: boolean) {

  const db = await getDb();

  if (!db) return;

  await db.update(modules).set({ isCatalogMaster: isMaster }).where(eq(modules.id, moduleId));

}



export async function setTrailMasterFlag(trailId: number, isMaster: boolean) {

  const db = await getDb();

  if (!db) return;

  await db.update(_learningTrails).set({ isCatalogMaster: isMaster as any }).where(eq(_learningTrails.id, trailId));

}



export async function cloneModuleForCompany(sourceModuleId: number, companyId: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const src = await db.select().from(modules).where(eq(modules.id, sourceModuleId)).limit(1);

  const m = src[0];

  if (!m) throw new Error("Módulo não encontrado");

  const insert = await db.insert(modules).values({

    orderIndex: m.orderIndex,

    title: m.title + ' (cópia)',

    description: m.description,

    videoUrl: m.videoUrl,

    thumbnailUrl: m.thumbnailUrl,

    durationMinutes: m.durationMinutes,

    isActive: true,

    certTitle: m.certTitle,

    certBody: m.certBody,

    certSignerName: m.certSignerName,

    certSignerRole: m.certSignerRole,

    isCatalogMaster: false,

    createdByCompanyId: companyId,

    clonedFromModuleId: sourceModuleId,

  } as any).$returningId();

  const newId = (insert as any)[0]?.id;

  // Clone lessons

  if (newId) {

    const srcLessons = await db.select().from(_lessonsTbl).where(eq(_lessonsTbl.moduleId, sourceModuleId));

    for (const l of srcLessons) {

      await db.insert(_lessonsTbl).values({

        moduleId: newId,

        orderIndex: l.orderIndex,

        title: l.title,

        description: l.description,

        videoUrl: l.videoUrl,

        durationMinutes: l.durationMinutes,

        isActive: l.isActive,

      } as any);

    }

  }

  return { id: newId };

}



export async function cloneTrailForCompany(sourceTrailId: number, companyId: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  const src = await db.select().from(_learningTrails).where(eq(_learningTrails.id, sourceTrailId)).limit(1);

  const t = src[0];

  if (!t) throw new Error("Trilha não encontrada");

  const ins = await db.insert(_learningTrails).values({

    title: t.title + ' (cópia)',

    description: t.description,

    objective: t.objective,

    thumbnailUrl: t.thumbnailUrl,

    isSequential: t.isSequential,

    isActive: 1,

    isCatalogMaster: false as any,

    createdByCompanyId: companyId,

    clonedFromTrailId: sourceTrailId,

  } as any).$returningId();

  const newId = (ins as any)[0]?.id;

  if (newId) {

    const tm = await db.select().from(_trailModules).where(eq(_trailModules.trailId, sourceTrailId));

    for (const m of tm) {

      await db.insert(_trailModules).values({

        trailId: newId,

        moduleId: m.moduleId,

        orderIndex: m.orderIndex,

        isRequired: m.isRequired,

      } as any);

    }

  }

  return { id: newId };

}



// ─── Configurador / Enrollments ──────────────────────────────────────────────

export async function listAvailableContentForCompany(companyId: number) {

  const db = await getDb();

  if (!db) return { modules: [], trails: [], enrollments: [] };

  const masterMods = await db.select().from(modules).where(eq(modules.isCatalogMaster, true));

  const ownMods = await db.select().from(modules).where(eq(modules.createdByCompanyId, companyId));

  const masterTrails = await db.select().from(_learningTrails).where(eq(_learningTrails.isCatalogMaster, true));

  const ownTrails = await db.select().from(_learningTrails).where(eq(_learningTrails.createdByCompanyId, companyId));

  const enrollments = await db.select().from(companyContentEnrollments).where(eq(companyContentEnrollments.companyId, companyId));

  return { masterModules: masterMods, ownModules: ownMods, masterTrails, ownTrails, enrollments };

}



export async function enrollCompanyInContent(

  companyId: number,

  contentType: 'module' | 'trail',

  contentId: number,

  branches?: number[] | null,

  departments?: number[] | null

) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  try {

    await db.insert(companyContentEnrollments).values({

      companyId,

      contentType,

      contentId,

      isActive: 1,

      assignedToBranches: branches ?? null,

      assignedToDepartments: departments ?? null,

    } as any);

  } catch {

    // Already exists — reactivate

    await db.update(companyContentEnrollments)

      .set({ isActive: 1, assignedToBranches: (branches ?? null) as any, assignedToDepartments: (departments ?? null) as any })

      .where(and(

        eq(companyContentEnrollments.companyId, companyId),

        eq(companyContentEnrollments.contentType, contentType),

        eq(companyContentEnrollments.contentId, contentId),

      ));

  }

  return { ok: true };

}



export async function unenrollCompanyFromContent(companyId: number, contentType: string, contentId: number) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(companyContentEnrollments)

    .set({ isActive: 0 })

    .where(and(

      eq(companyContentEnrollments.companyId, companyId),

      eq(companyContentEnrollments.contentType, contentType),

      eq(companyContentEnrollments.contentId, contentId),

    ));

}



export async function updateEnrollmentAssignments(enrollmentId: number, branches: number[] | null, departments: number[] | null) {

  const db = await getDb();

  if (!db) throw new Error("DB not available");

  await db.update(companyContentEnrollments)

    .set({ assignedToBranches: branches as any, assignedToDepartments: departments as any })

    .where(eq(companyContentEnrollments.id, enrollmentId));

}



// Modules visible to a given user, applying tenancy rules

export async function getVisibleModulesForUser(userId: number) {

  const db = await getDb();

  if (!db) return [];

  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const user = u[0];

  if (!user) return [];

  // Super admin sees all

  if (user.role === 'super_admin') {

    return db.select().from(modules).where(eq(modules.isActive, true)).orderBy(modules.orderIndex);

  }

  const cid = user.companyId;

  if (!cid) {

    // Fallback: legacy behavior — show all active modules

    return db.select().from(modules).where(eq(modules.isActive, true)).orderBy(modules.orderIndex);

  }

  // Enrolled module ids

  const enrolls = await db.select().from(companyContentEnrollments).where(and(

    eq(companyContentEnrollments.companyId, cid),

    eq(companyContentEnrollments.contentType, 'module'),

    eq(companyContentEnrollments.isActive, 1),

  ));

  const branchId = (user as any).branchId ?? null;

  const sectorId = (user as any).sectorId ?? null;

  const filteredIds: number[] = [];

  for (const e of enrolls) {

    const bs = (e.assignedToBranches as any) as number[] | null;

    const ds = (e.assignedToDepartments as any) as number[] | null;

    if (bs && bs.length && branchId != null && !bs.includes(branchId)) continue;

    if (ds && ds.length && sectorId != null && !ds.includes(sectorId)) continue;

    filteredIds.push(e.contentId);

  }

  // Own company-created modules
  const own = await db.select().from(modules).where(and(
    eq(modules.createdByCompanyId, cid),
    eq(modules.isActive, true),
  ));

  // Platform-level modules (no specific company — visible to all)
  const platform = await db.select().from(modules).where(and(
    sql`${modules.createdByCompanyId} IS NULL`,
    eq(modules.isActive, true),
  ));

  let enrolled: any[] = [];

  if (filteredIds.length) {

    enrolled = await db.select().from(modules).where(and(

      eq(modules.isActive, true),

      sql`${modules.id} IN (${sql.raw(filteredIds.join(','))})`,

    ));

  }

  // Dedup by id
  const map = new Map<number, any>();

  for (const m of [...enrolled, ...own, ...platform]) map.set(m.id, m);

  return Array.from(map.values()).sort((a, b) => { const oi = (a.orderIndex ?? 0) - (b.orderIndex ?? 0); return oi !== 0 ? oi : (b.id - a.id); });

}



export async function getVisibleTrailsForUser(userId: number) {

  const db = await getDb();

  if (!db) return [];

  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const user = u[0];

  if (!user) return [];

  if (user.role === 'super_admin') {

    return db.select().from(_learningTrails).where(eq(_learningTrails.isActive, 1));

  }

  const cid = user.companyId;

  if (!cid) return db.select().from(_learningTrails).where(eq(_learningTrails.isActive, 1));

  const enrolls = await db.select().from(companyContentEnrollments).where(and(

    eq(companyContentEnrollments.companyId, cid),

    eq(companyContentEnrollments.contentType, 'trail'),

    eq(companyContentEnrollments.isActive, 1),

  ));

  const branchId = (user as any).branchId ?? null;

  const sectorId = (user as any).sectorId ?? null;

  const ids: number[] = [];

  for (const e of enrolls) {

    const bs = (e.assignedToBranches as any) as number[] | null;

    const ds = (e.assignedToDepartments as any) as number[] | null;

    if (bs && bs.length && branchId != null && !bs.includes(branchId)) continue;

    if (ds && ds.length && sectorId != null && !ds.includes(sectorId)) continue;

    ids.push(e.contentId);

  }

  const own = await db.select().from(_learningTrails).where(and(

    eq(_learningTrails.createdByCompanyId, cid),

    eq(_learningTrails.isActive, 1),

  ));

  let enrolled: any[] = [];

  if (ids.length) {

    enrolled = await db.select().from(_learningTrails).where(and(

      eq(_learningTrails.isActive, 1),

      sql`${_learningTrails.id} IN (${sql.raw(ids.join(','))})`,

    ));

  }

  const map = new Map<number, any>();

  for (const t of [...enrolled, ...own]) map.set(t.id, t);

  return Array.from(map.values());

}



// ===AI_COMPLIANCE_SURVEYS_v1===

// ─────────────────────────────────────────────────────────────────────────────

// AI Studio

// ─────────────────────────────────────────────────────────────────────────────

import { sql as _rawSql } from "drizzle-orm";



export async function createAIGeneration(data: {

  companyId: number; userId: number; prompt: string; sourceMaterialUrl?: string | null;

  targetDurationMinutes?: number; level?: string; language?: string;

  includeQuiz?: boolean; includeCertificate?: boolean;

}) {

  const db = await getDb();

  if (!db) throw new Error("DB unavailable");

  const r: any = await db.execute(_rawSql`INSERT INTO ai_course_generations

    (company_id, user_id, prompt, source_material_url, target_duration_minutes, level, language, include_quiz, include_certificate, status)

    VALUES (${data.companyId}, ${data.userId}, ${data.prompt}, ${data.sourceMaterialUrl ?? null}, ${data.targetDurationMinutes ?? 30}, ${data.level ?? "basico"}, ${data.language ?? "pt-BR"}, ${data.includeQuiz ?? true}, ${data.includeCertificate ?? true}, 'generating')`);

  const id = Number((r as any)[0]?.insertId ?? (r as any).insertId ?? 0);

  return id;

}



export async function markAIGenerationDone(id: number, moduleId: number, outline: any) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`UPDATE ai_course_generations SET status='done', generated_module_id=${moduleId}, generated_outline=${JSON.stringify(outline)}, completed_at=NOW() WHERE id=${id}`);

}



export async function markAIGenerationFailed(id: number, errorMessage: string) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`UPDATE ai_course_generations SET status='failed', error_message=${errorMessage}, completed_at=NOW() WHERE id=${id}`);

}



export async function listAIGenerationsForCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  const r: any = await db.execute(_rawSql`SELECT id, prompt, status, target_duration_minutes AS targetDurationMinutes, level, generated_module_id AS generatedModuleId, created_at AS createdAt, completed_at AS completedAt FROM ai_course_generations WHERE company_id=${companyId} ORDER BY created_at DESC LIMIT 50`);

  return (r as any)[0] ?? [];

}

export async function updateAIGenerationProgress(id: number, percent: number, message: string) {

  const db = await getDb();

  if (!db) return;

  try {

    await db.execute(_rawSql`UPDATE ai_course_generations SET progress_percent=${percent}, progress_message=${message} WHERE id=${id}`);

  } catch (e) {

    console.error("[updateAIGenerationProgress] failed:", e);

  }

}



export async function getAIGenerationStatus(id: number) {

  const db = await getDb();

  if (!db) return null;

  const r: any = await db.execute(_rawSql`SELECT id, status, progress_percent AS progressPercent, progress_message AS progressMessage, generated_module_id AS generatedModuleId, error_message AS errorMessage, generated_outline AS previewOutline FROM ai_course_generations WHERE id=${id} LIMIT 1`);

  return (r as any)[0]?.[0] ?? null;

}



export async function getAIGenerationById(id: number) {

  const db = await getDb();

  if (!db) return null;

  const r: any = await db.execute(_rawSql`SELECT id, prompt, status, target_duration_minutes AS targetDurationMinutes, level, language, generated_module_id AS generatedModuleId, generated_outline AS generatedOutline, error_message AS errorMessage, created_at AS createdAt, completed_at AS completedAt FROM ai_course_generations WHERE id=${id} LIMIT 1`);

  const row = (r as any)[0]?.[0];

  if (!row) return null;

  if (typeof row.generatedOutline === "string") {

    try { row.generatedOutline = JSON.parse(row.generatedOutline); } catch {}

  }

  return row;

}





export function generateCourseFromPromptStub(prompt: string, opts: { durationMinutes?: number; level?: string }) {

  const p = (prompt || "").toLowerCase();

  const duration = opts.durationMinutes ?? 30;

  const level = opts.level ?? "basico";



  type Lesson = { title: string; content: string; durationMinutes: number };

  let title = "Curso Personalizado";

  let description = "Treinamento gerado a partir do seu prompt.";

  let lessons: Lesson[] = [];



  const mkLesson = (t: string, c: string, m: number): Lesson => ({ title: t, content: c, durationMinutes: m });

  const per = Math.max(5, Math.round(duration / 4));



  if (p.includes("nr-33") || p.includes("nr33") || p.includes("espaço confinado") || p.includes("espaco confinado") || p.includes("confinado")) {

    title = "NR-33 — Trabalho em Espaços Confinados";

    description = "Capacitação obrigatória conforme NR-33 para entrada e trabalho seguro em espaços confinados (tanques, silos, galerias, dutos, casas de máquinas).";

    lessons = [

      mkLesson("Conceitos e identificação de espaços confinados", "Espaço confinado é qualquer área não projetada para ocupação humana contínua, com meios limitados de entrada/saída e ventilação insuficiente, podendo conter atmosfera perigosa. Exemplos: tanques, silos, galerias, dutos, caixas, poços, casas de máquinas. A NR-33 define obrigações para entrada segura: identificação, sinalização, classificação dos riscos, PET (Permissão de Entrada e Trabalho).", per),

      mkLesson("Riscos atmosféricos e físicos", "Atmosféricos: deficiência ou enriquecimento de oxigênio, gases tóxicos (H2S, CO, NH3), inflamáveis (metano, vapores de solvente), explosivos. Físicos: soterramento, afogamento, eletricidade, calor, ruído, máquinas em movimento, queda. Monitoramento contínuo com detector multigás calibrado. Limites: O2 entre 20,9% e 19,5%, LEL <10%, gases tóxicos abaixo dos TLVs.", per),

      mkLesson("PET, equipamentos e procedimentos de entrada", "Permissão de Entrada e Trabalho (PET): documento obrigatório por turno com análise de risco, ventilação forçada, isolamento de fontes de energia (LOTO), EPIs (mascara autônoma, cinto paraquedista, capacete), EPCs (tripé com sistema retrátil, comunicação com vigia). Função do Vigia, Trabalhador Autorizado e Supervisor de Entrada — capacitação NR-33 específica para cada papel.", per),

      mkLesson("Emergência e resgate em espaços confinados", "60% das mortes em espaço confinado são de socorristas não treinados. Plano de resgate obrigatório: equipamentos (talha, descensor, máscara de fuga), equipe externa preparada, simulações periódicas. Primeiros socorros: avaliação primária, oxigenoterapia, RCP em vítima com suspeita de inalação tóxica, descontaminação. Importância da comunicação com Bombeiros (193) e CAT.", per),

    ];

  } else if (p.includes("nr-35") || p.includes("nr35") || p.includes("altura")) {

    title = "NR-35 — Trabalho em Altura";

    description = "Capacitação obrigatória conforme NR-35 para trabalhos acima de 2 metros de altura, abordando análise de risco, EPIs e técnicas seguras.";

    lessons = [

      mkLesson("Fundamentos da NR-35 e responsabilidades", "A NR-35 estabelece os requisitos mínimos para a proteção dos trabalhadores que executam atividades em altura, definidas como toda atividade realizada acima de 2 metros do nível inferior onde haja risco de queda. Esta aula apresenta o histórico da norma, suas atualizações mais recentes, as responsabilidades do empregador (capacitação, fornecimento de EPI/EPC, análise de risco) e do trabalhador (uso adequado de equipamentos, comunicação de não conformidades). Discutimos também a documentação obrigatória: ART de instalação, PT (permissão de trabalho), APR (análise preliminar de risco) e atestados de saúde ocupacional específicos. Casos reais de acidentes graves no Brasil são analisados para reforçar a importância de cada item normativo.", per),

      mkLesson("Análise de Risco e Permissão de Trabalho (PT)", "Toda atividade em altura exige uma análise prévia de riscos documentada. Nesta aula você aprende a identificar perigos como queda de altura, queda de objetos, choque elétrico em proximidade de redes, condições climáticas adversas, isolamento da área e resgate. Apresentamos modelo prático de APR e PT, com checklist completo. Discutimos a hierarquia de controles (eliminar, substituir, EPC, sinalização, EPI) e como classificar riscos por probabilidade × severidade. Exercício prático: o aluno preenche uma APR para uma situação simulada de manutenção em telhado.", per),

      mkLesson("EPIs e Sistemas de Proteção contra Quedas", "Detalhamento dos componentes essenciais: cinturão de segurança tipo paraquedista (UL/CE), talabarte duplo com absorvedor de energia, trava-quedas retrátil e deslizante, capacete com jugular, linha de vida, ancoragens e conectores. Como inspecionar diariamente cada item, validade, descarte e armazenamento. Diferenças entre sistema de retenção, restrição e posicionamento. Demonstração de cálculo de fator de queda e distância livre necessária para evitar impacto.", per),

      mkLesson("Procedimentos de Resgate e Emergência", "Tempo é fator crítico: a síndrome do arnês pode ser fatal em poucos minutos. Esta aula apresenta planos de resgate obrigatórios, equipamentos de resgate em altura (kit RGA, tripé com talha, descensor automático), composição da equipe de resgate, comunicação via rádio, simulações periódicas e primeiros socorros pós-resgate. Discussão de cenários e elaboração de plano de resgate para a sua realidade operacional.", per),

    ];

  } else if (p.includes("nr-10") || p.includes("nr10") || p.includes("elétric") || p.includes("eletric")) {

    title = "NR-10 — Segurança em Instalações Elétricas";

    description = "Treinamento conforme NR-10 para trabalhadores que interagem com instalações e serviços em eletricidade.";

    lessons = [

      mkLesson("Riscos elétricos e a NR-10", "A NR-10 estabelece condições mínimas para implementação de medidas de controle e sistemas preventivos, de forma a garantir a segurança e a saúde dos trabalhadores que direta ou indiretamente interajam em instalações elétricas e serviços com eletricidade. Apresentamos os principais riscos: choque elétrico (contato direto e indireto), arco elétrico, queimaduras, campos eletromagnéticos e quedas decorrentes. Estatísticas brasileiras de acidentes de origem elétrica e o conceito de zona de risco × zona controlada.", per),

      mkLesson("Medidas de controle e prontuário", "Detalhamento das medidas de controle obrigatórias: desenergização, aterramento temporário, equipotencialização, bloqueio e etiquetagem (LOTO), sinalização e isolamento da área. Conteúdo do Prontuário de Instalações Elétricas (PIE): diagramas unifilares, especificações de equipamentos de proteção, procedimentos operacionais, certificações da equipe e relatórios de inspeção. Como organizar e manter o PIE atualizado.", per),

      mkLesson("EPIs e EPCs para serviços elétricos", "EPIs específicos: capacete classe B, óculos com lente verde para arco voltaico, vestimenta antichama (ATPV adequado à energia incidente), luvas isolantes classe 00 a 4, calçado isolante. EPCs: detectores de tensão, bastões de manobra, tapetes isolantes, cobertura isolante, balizamento. Procedimentos de inspeção, ensaios periódicos e armazenamento. Cálculo simplificado de energia incidente.", per),

      mkLesson("Primeiros socorros em acidentes elétricos", "Atendimento imediato à vítima de choque: desenergização segura, avaliação primária (ABC), reanimação cardiopulmonar adaptada para vítimas de choque, tratamento de queimaduras elétricas (lesão de entrada e saída), encaminhamento e comunicação de acidente. Reconhecimento de fibrilação ventricular e uso de DEA (desfibrilador externo automático).", per),

    ];

  } else if (p.includes("ergonom") || p.includes("ler") || p.includes("dort")) {

    title = "Ergonomia no Trabalho — NR-17";

    description = "Princípios e práticas de ergonomia laboral para prevenção de LER/DORT e melhoria do conforto e produtividade.";

    lessons = [

      mkLesson("Fundamentos da Ergonomia (NR-17)", "Ergonomia é a ciência que adapta o trabalho ao ser humano, considerando aspectos físicos, cognitivos e organizacionais. A NR-17 define parâmetros para mobiliário, equipamentos, condições ambientais (iluminação, ruído, temperatura) e organização do trabalho (pausas, ritmo, monotonia). Apresentamos a AET (Análise Ergonômica do Trabalho) obrigatória e os principais riscos ergonômicos: posturas inadequadas, movimentos repetitivos, levantamento de cargas, jornadas excessivas.", per),

      mkLesson("Postura correta e organização do posto", "Ajuste correto da cadeira (altura, profundidade, encosto lombar, apoios de braço), monitor à altura dos olhos a um braço de distância, teclado e mouse alinhados, apoio de pés quando necessário. Iluminação adequada para evitar reflexos. Para trabalho em pé: tapete antifadiga, alternância de posições, alturas de bancada adequadas à tarefa. Demonstração visual e checklist de avaliação do próprio posto.", per),

      mkLesson("Prevenção de LER/DORT", "LER (Lesões por Esforço Repetitivo) e DORT (Distúrbios Osteomusculares Relacionados ao Trabalho): tendinites, síndrome do túnel do carpo, epicondilite, bursites, cervicalgia. Sinais precoces: formigamento, dor que persiste após o expediente, perda de força. Importância da pausa ativa, alongamentos durante a jornada, fortalecimento muscular e procura precoce ao médico do trabalho. Exercícios práticos demonstrados.", per),

      mkLesson("Ergonomia cognitiva e organizacional", "Aspectos cognitivos: carga mental, atenção dividida, fadiga decisional, interfaces e usabilidade de sistemas. Aspectos organizacionais: cadência de produção, autonomia, sistemas de avaliação por metas, jornada e pausas conforme NR-17. Como propor melhorias e participar do mapeamento ergonômico da empresa.", per),

    ];

  } else if (p.includes("burnout") || p.includes("saúde mental") || p.includes("saude mental") || p.includes("estress")) {

    title = "Saúde Mental no Trabalho";

    description = "Promoção da saúde mental, prevenção de burnout e gestão do estresse ocupacional conforme atualização da NR-01.";

    lessons = [

      mkLesson("Saúde mental e o mundo do trabalho", "Os transtornos mentais já são a 3ª maior causa de afastamento previdenciário no Brasil. Apresentamos os principais quadros relacionados ao trabalho: estresse crônico, ansiedade, depressão e síndrome de burnout (reconhecida pela OMS desde 2022). Discussão sobre fatores de risco psicossociais e a inclusão obrigatória na NR-01 a partir de maio/2025.", per),

      mkLesson("Reconhecendo os sinais de burnout", "Burnout tem três dimensões: exaustão emocional, despersonalização (cinismo) e baixa realização profissional. Sintomas físicos: insônia, dores de cabeça crônicas, problemas gastrointestinais, alterações de apetite. Sintomas comportamentais: isolamento, irritabilidade, queda de produtividade, presenteísmo. Como aplicar autoavaliação inicial e quando buscar ajuda profissional.", per),

      mkLesson("Estratégias de prevenção individual e coletiva", "Individuais: higiene do sono, atividade física regular, mindfulness, limites entre vida e trabalho, rede de apoio. Coletivas (responsabilidade da organização): carga de trabalho equilibrada, autonomia, reconhecimento, comunicação clara, suporte da liderança, canais de escuta. Programa de Bem-estar e ações concretas que a empresa pode implementar.", per),

      mkLesson("Quando e como buscar ajuda", "Diferença entre tristeza/estresse passageiro e quadros clínicos. Canais disponíveis: médico do trabalho, plano de saúde, CAPS, terapia online subsidiada. Importância de desestigmatizar o pedido de ajuda. Como conversar com gestor ou RH sobre necessidade de afastamento ou ajustes. Direitos previdenciários (CAT, B91 vs B31).", per),

    ];

  } else if (p.includes("assédio") || p.includes("assedio")) {

    title = "Prevenção ao Assédio Moral e Sexual";

    description = "Capacitação obrigatória conforme NR-05 atualizada (2023) sobre prevenção do assédio sexual e demais formas de violência no trabalho.";

    lessons = [

      mkLesson("Conceitos: assédio moral, sexual e discriminação", "Assédio moral: conduta abusiva, repetitiva, que atinge a dignidade ou integridade psíquica do trabalhador. Assédio sexual: conduta de natureza sexual indesejada que constrange. Discriminação: tratamento desigual por gênero, raça, orientação sexual, idade, deficiência etc. Diferenças entre conflito legítimo, gestão rigorosa e assédio. Marco legal: CLT, Lei 14.457/2022, Convenção 190 OIT.", per),

      mkLesson("Identificando situações de assédio", "Tipos de assédio moral: vertical descendente (chefe→subordinado), ascendente, horizontal e organizacional. Exemplos concretos: isolamento, humilhação pública, sobrecarga proposital, retirada de função, comentários degradantes. Assédio sexual: chantagem, comentários, toques indesejados, propostas explícitas. Linha tênue entre brincadeira e ofensa: o critério é a percepção da vítima e o constrangimento gerado.", per),

      mkLesson("Canais de denúncia e procedimentos", "Lei 14.457/2022 obriga empresas com CIPA a implementar canal de denúncia, capacitação e procedimentos. Como funciona o canal interno (anonimato, confidencialidade, proteção contra retaliação), o papel da Comissão de Prevenção e Apuração, prazos e direitos da vítima. Canais externos: MPT, Sindicato, Polícia (em caso de crime).", per),

      mkLesson("Responsabilidade coletiva e cultura de respeito", "Todos têm papel: vítima (buscar apoio), testemunha (não ser conivente, oferecer suporte), gestor (intervenção e escuta ativa), empresa (políticas, treinamentos, punições efetivas). Sinais de uma cultura saudável: feedback respeitoso, escuta ativa, diversidade valorizada, lideranças exemplares. Cases reais de empresas que transformaram sua cultura.", per),

    ];

  } else {

    // Generic SST course

    const nrMatch = prompt.match(/NR[-\s]?\d{1,2}/i);

    title = nrMatch ? `${nrMatch[0].toUpperCase().replace(/\s/g,"-")} — Treinamento` : `Treinamento: ${prompt.slice(0, 80)}`;

    description = `Curso personalizado em Saúde do Trabalho gerado a partir do seu prompt. Nível ${level}, duração estimada ${duration} minutos.`;

    lessons = [

      mkLesson("Introdução e contextualização", `Apresentação dos objetivos do treinamento, contexto regulatório aplicável e relevância do tema "${prompt.slice(0, 60)}" para a Saúde e Segurança do Trabalho. Discussão sobre o público-alvo, pré-requisitos e resultados esperados. Apresentamos o marco normativo brasileiro pertinente (NRs, Lei 8.213, Decreto 3.048) e como o tema se conecta com a estratégia de SST da empresa. Análise de dados epidemiológicos e de acidentes do setor relacionados.`, per),

      mkLesson("Fundamentos teóricos", `Conceitos centrais necessários para compreender o tema em profundidade. Definições técnicas, terminologia adotada pela legislação e órgãos de fiscalização (MTE, INSS, Anvisa quando aplicável). Identificação de riscos, agentes envolvidos, medidas hierárquicas de controle (eliminação, substituição, EPC, sinalização, EPI) e papéis no SESMT/CIPA. Estudo de caso introdutório para fixação dos conceitos.`, per),

      mkLesson("Boas práticas e procedimentos", `Procedimentos operacionais seguros aplicáveis ao tema. Passo a passo de execução, checklist pré-tarefa, conduta durante e pós-tarefa. Documentação obrigatória, registros e evidências. Demonstração com exemplos práticos do cotidiano profissional. Erros comuns e como evitá-los. Comunicação de não conformidades.`, per),

      mkLesson("Emergência, primeiros socorros e responsabilidades", `Plano de resposta a emergências relacionado ao tema. Procedimentos de primeiros socorros específicos quando aplicável. Comunicação de acidentes (CAT), responsabilidades civis e criminais. Encerramento com revisão dos pontos-chave e indicações de aprofundamento.`, per),

    ];

  }

  return { title, description, durationMinutes: duration, lessons };

}



// ─────────────────────────────────────────────────────────────────────────────

// Compliance Hub

// ─────────────────────────────────────────────────────────────────────────────

export async function listComplianceItems() {

  const db = await getDb();

  if (!db) return [];

  const r: any = await db.execute(_rawSql`SELECT id, code, name, category, description, legal_basis AS legalBasis, is_mandatory_for_all AS isMandatoryForAll, display_order AS displayOrder FROM compliance_items ORDER BY display_order`);

  return (r as any)[0] ?? [];

}



export async function getCompanyComplianceStatus(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  const r: any = await db.execute(_rawSql`

    SELECT ci.id, ci.code, ci.name, ci.category, ci.description, ci.legal_basis AS legalBasis, ci.is_mandatory_for_all AS isMandatoryForAll,

           COALESCE(s.status, 'not_started') AS status,

           COALESCE(s.completion_percent, 0) AS completionPercent,

           s.notes, s.evidence_url AS evidenceUrl, s.last_reviewed_at AS lastReviewedAt, s.next_review_at AS nextReviewAt

    FROM compliance_items ci

    LEFT JOIN company_compliance_status s ON s.compliance_item_id=ci.id AND s.company_id=${companyId}

    ORDER BY ci.display_order

  `);

  return (r as any)[0] ?? [];

}



export async function updateComplianceStatus(companyId: number, itemId: number, status: string, completionPercent: number, notes?: string, evidenceUrl?: string) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`INSERT INTO company_compliance_status (company_id, compliance_item_id, status, completion_percent, notes, evidence_url, last_reviewed_at)

    VALUES (${companyId}, ${itemId}, ${status}, ${completionPercent}, ${notes ?? null}, ${evidenceUrl ?? null}, NOW())

    ON DUPLICATE KEY UPDATE status=${status}, completion_percent=${completionPercent}, notes=${notes ?? null}, evidence_url=${evidenceUrl ?? null}, last_reviewed_at=NOW()`);

}



export async function getOverallComplianceScore(companyId: number) {

  const db = await getDb();

  if (!db) return 0;

  const r: any = await db.execute(_rawSql`SELECT AVG(COALESCE(s.completion_percent, 0)) AS score FROM compliance_items ci LEFT JOIN company_compliance_status s ON s.compliance_item_id=ci.id AND s.company_id=${companyId}`);

  return Math.round(Number((r as any)[0]?.[0]?.score ?? 0));

}



// ─────────────────────────────────────────────────────────────────────────────

// Surveys

// ─────────────────────────────────────────────────────────────────────────────

export async function listSurveysForCompany(companyId: number) {

  const db = await getDb();

  if (!db) return [];

  const r: any = await db.execute(_rawSql`SELECT id, title, description, category, status, is_anonymous AS isAnonymous, created_at AS createdAt FROM surveys WHERE company_id=${companyId} ORDER BY created_at DESC`);

  return (r as any)[0] ?? [];

}



export async function listSurveyTemplates() {

  const db = await getDb();

  if (!db) return [];

  const r: any = await db.execute(_rawSql`SELECT id, title, description, category FROM surveys WHERE is_template=TRUE ORDER BY id`);

  return (r as any)[0] ?? [];

}



export async function getSurveyById(id: number) {

  const db = await getDb();

  if (!db) return null;

  const r: any = await db.execute(_rawSql`SELECT id, company_id AS companyId, title, description, category, status, is_anonymous AS isAnonymous, starts_at AS startsAt, ends_at AS endsAt FROM surveys WHERE id=${id} LIMIT 1`);

  const row = (r as any)[0]?.[0];

  if (!row) return null;

  const qs: any = await db.execute(_rawSql`SELECT id, question_text AS questionText, question_type AS questionType, options, is_required AS isRequired, order_index AS orderIndex FROM survey_questions WHERE survey_id=${id} ORDER BY order_index`);

  return { ...row, questions: (qs as any)[0] ?? [] };

}



export async function createSurvey(data: { companyId: number; title: string; description?: string; category?: string; isAnonymous?: boolean; createdBy?: number }) {

  const db = await getDb();

  if (!db) throw new Error("DB unavailable");

  const r: any = await db.execute(_rawSql`INSERT INTO surveys (company_id, title, description, category, is_anonymous, status, created_by) VALUES (${data.companyId}, ${data.title}, ${data.description ?? null}, ${data.category ?? "customizado"}, ${data.isAnonymous ?? true}, 'draft', ${data.createdBy ?? null})`);

  return Number((r as any)[0]?.insertId ?? (r as any).insertId ?? 0);

}



export async function createSurveyFromTemplate(templateId: number, companyId: number, createdBy?: number) {

  const db = await getDb();

  if (!db) throw new Error("DB unavailable");

  const tpl = await getSurveyById(templateId);

  if (!tpl) throw new Error("Template não encontrado");

  const newId = await createSurvey({ companyId, title: tpl.title, description: tpl.description, category: tpl.category, isAnonymous: tpl.isAnonymous, createdBy });

  for (const q of tpl.questions) {

    await db.execute(_rawSql`INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, order_index) VALUES (${newId}, ${q.questionText}, ${q.questionType}, ${q.options ? JSON.stringify(q.options) : null}, ${q.isRequired ? 1 : 0}, ${q.orderIndex})`);

  }

  return newId;

}



export async function addSurveyQuestion(surveyId: number, data: { questionText: string; questionType: string; options?: any; isRequired?: boolean; orderIndex?: number }) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, order_index) VALUES (${surveyId}, ${data.questionText}, ${data.questionType}, ${data.options ? JSON.stringify(data.options) : null}, ${data.isRequired ? 1 : 0}, ${data.orderIndex ?? 0})`);

}



export async function deleteSurveyQuestion(id: number) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`DELETE FROM survey_questions WHERE id=${id}`);

}



export async function updateSurveyStatus(id: number, status: string) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`UPDATE surveys SET status=${status}, starts_at=IF(${status}='active' AND starts_at IS NULL, NOW(), starts_at), ends_at=IF(${status}='closed', NOW(), ends_at) WHERE id=${id}`);

}



export async function deleteSurvey(id: number) {

  const db = await getDb();

  if (!db) return;

  await db.execute(_rawSql`DELETE FROM survey_answers WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id=${id})`);

  await db.execute(_rawSql`DELETE FROM survey_responses WHERE survey_id=${id}`);

  await db.execute(_rawSql`DELETE FROM survey_questions WHERE survey_id=${id}`);

  await db.execute(_rawSql`DELETE FROM surveys WHERE id=${id}`);

}



export async function submitSurveyResponse(surveyId: number, answers: { questionId: number; value: string }[], userId?: number, branchId?: number, sectorId?: number) {

  const db = await getDb();

  if (!db) throw new Error("DB unavailable");

  const r: any = await db.execute(_rawSql`INSERT INTO survey_responses (survey_id, user_id, branch_id, sector_id) VALUES (${surveyId}, ${userId ?? null}, ${branchId ?? null}, ${sectorId ?? null})`);

  const responseId = Number((r as any)[0]?.insertId ?? (r as any).insertId ?? 0);

  for (const a of answers) {

    await db.execute(_rawSql`INSERT INTO survey_answers (response_id, question_id, answer_value) VALUES (${responseId}, ${a.questionId}, ${a.value})`);

  }

  return responseId;

}



export async function getSurveyResults(surveyId: number) {

  const db = await getDb();

  if (!db) return { totalResponses: 0, byQuestion: [] };

  const totalR: any = await db.execute(_rawSql`SELECT COUNT(*) AS c FROM survey_responses WHERE survey_id=${surveyId}`);

  const total = Number((totalR as any)[0]?.[0]?.c ?? 0);

  const qsR: any = await db.execute(_rawSql`SELECT id, question_text AS questionText, question_type AS questionType FROM survey_questions WHERE survey_id=${surveyId} ORDER BY order_index`);

  const questions = (qsR as any)[0] ?? [];

  const byQuestion: any[] = [];

  for (const q of questions) {

    const aR: any = await db.execute(_rawSql`SELECT answer_value AS v, COUNT(*) AS c FROM survey_answers WHERE question_id=${q.id} GROUP BY answer_value`);

    const rows = (aR as any)[0] ?? [];

    let avg: number | null = null;

    if (q.questionType === "likert" || q.questionType === "nps") {

      let sum = 0, n = 0;

      for (const r of rows) { const v = Number(r.v); if (!isNaN(v)) { sum += v * Number(r.c); n += Number(r.c); } }

      avg = n > 0 ? +(sum / n).toFixed(2) : null;

    }

    byQuestion.push({ questionId: q.id, questionText: q.questionText, questionType: q.questionType, distribution: rows, average: avg });

  }

  return { totalResponses: total, byQuestion };

}



export async function listActiveSurveysForUser(userId: number) {

  const db = await getDb();

  if (!db) return [];

  const userR: any = await db.execute(_rawSql`SELECT company_id FROM users WHERE id=${userId} LIMIT 1`);

  const cid = (userR as any)[0]?.[0]?.company_id;

  if (!cid) return [];

  const r: any = await db.execute(_rawSql`SELECT s.id, s.title, s.description, s.category, s.is_anonymous AS isAnonymous

    FROM surveys s

    WHERE s.company_id=${cid} AND s.status='active'

      AND NOT EXISTS (SELECT 1 FROM survey_responses sr WHERE sr.survey_id=s.id AND sr.user_id=${userId})

    ORDER BY s.created_at DESC`);

  return (r as any)[0] ?? [];

}





// ── AI Survey Generation Helpers ──────────────────────────────────────────
export async function createAISurveyGeneration(data: {
  companyId: number; userId: number; topic: string; surveyType: string; questionCount: number; isAnonymous: boolean;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const r: any = await db.execute(_rawSql`INSERT INTO ai_survey_generations (company_id, user_id, topic, survey_type, question_count, is_anonymous) VALUES (${data.companyId}, ${data.userId}, ${data.topic}, ${data.surveyType}, ${data.questionCount}, ${data.isAnonymous ? 1 : 0})`);
  const rr: any = await db.execute(_rawSql`SELECT LAST_INSERT_ID() as id`);
  return Number((rr as any)[0]?.[0]?.id ?? 0);
}

export async function updateAISurveyProgress(id: number, percent: number, message: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(_rawSql`UPDATE ai_survey_generations SET progress_percent=${percent}, progress_message=${message} WHERE id=${id}`);
  } catch (e) { console.error("[updateAISurveyProgress]", e); }
}

export async function markAISurveyDone(id: number, surveyId: number, outline: any) {
  const db = await getDb();
  if (!db) return;
  await db.execute(_rawSql`UPDATE ai_survey_generations SET status='done', progress_percent=100, generated_survey_id=${surveyId}, generated_outline=${JSON.stringify(outline)} WHERE id=${id}`);
}

export async function markAISurveyFailed(id: number, errorMessage: string) {
  const db = await getDb();
  if (!db) return;
  await db.execute(_rawSql`UPDATE ai_survey_generations SET status='failed', error_message=${errorMessage} WHERE id=${id}`);
}

export async function getAISurveyStatus(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(_rawSql`SELECT id, status, progress_percent AS progressPercent, progress_message AS progressMessage, generated_survey_id AS generatedSurveyId, error_message AS errorMessage FROM ai_survey_generations WHERE id=${id} LIMIT 1`);
  return (r as any)[0]?.[0] ?? null;
}

// ── AI Decompression Generation Helpers ───────────────────────────────────
export async function createAIDecompressionGeneration(data: {
  companyId: number; userId: number; theme: string; durationMinutes: number; tone: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.execute(_rawSql`INSERT INTO ai_decompression_generations (company_id, user_id, theme, duration_minutes, tone) VALUES (${data.companyId}, ${data.userId}, ${data.theme}, ${data.durationMinutes}, ${data.tone})`);
  const rr: any = await db.execute(_rawSql`SELECT LAST_INSERT_ID() as id`);
  return Number((rr as any)[0]?.[0]?.id ?? 0);
}

export async function updateAIDecompressionProgress(id: number, percent: number, message: string) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(_rawSql`UPDATE ai_decompression_generations SET progress_percent=${percent}, progress_message=${message} WHERE id=${id}`);
  } catch (e) { console.error("[updateAIDecompressionProgress]", e); }
}

export async function markAIDecompressionDone(id: number, activityId: number, outline: any) {
  const db = await getDb();
  if (!db) return;
  await db.execute(_rawSql`UPDATE ai_decompression_generations SET status='done', progress_percent=100, generated_activity_id=${activityId}, generated_outline=${JSON.stringify(outline)} WHERE id=${id}`);
}

export async function markAIDecompressionFailed(id: number, errorMessage: string) {
  const db = await getDb();
  if (!db) return;
  await db.execute(_rawSql`UPDATE ai_decompression_generations SET status='failed', error_message=${errorMessage} WHERE id=${id}`);
}

export async function getAIDecompressionStatus(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(_rawSql`SELECT id, status, progress_percent AS progressPercent, progress_message AS progressMessage, generated_activity_id AS generatedActivityId, error_message AS errorMessage FROM ai_decompression_generations WHERE id=${id} LIMIT 1`);
  return (r as any)[0]?.[0] ?? null;
}

// ── Decompression Activities CRUD ─────────────────────────────────────────
export async function listDecompressionActivities(companyId: number | null) {
  const db = await getDb();
  if (!db) return [];
  if (companyId) {
    const r: any = await db.execute(_rawSql`SELECT id, title, description, category, type, duration_minutes AS durationMinutes, tone, content, cover_image_url AS coverImageUrl, is_active AS isActive, order_index AS orderIndex, created_at AS createdAt FROM decompression_activities WHERE company_id=${companyId} OR company_id IS NULL ORDER BY order_index ASC, id DESC`);
    return ((r as any)[0] || []) as any[];
  } else {
    const r: any = await db.execute(_rawSql`SELECT id, title, description, category, type, duration_minutes AS durationMinutes, tone, content, cover_image_url AS coverImageUrl, is_active AS isActive, order_index AS orderIndex, created_at AS createdAt FROM decompression_activities WHERE is_active=1 ORDER BY order_index ASC, id DESC`);
    return ((r as any)[0] || []) as any[];
  }
}

export async function getDecompressionActivity(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(_rawSql`SELECT id, title, description, category, type, duration_minutes AS durationMinutes, tone, content, cover_image_url AS coverImageUrl, is_active AS isActive, order_index AS orderIndex FROM decompression_activities WHERE id=${id} LIMIT 1`);
  return (r as any)[0]?.[0] ?? null;
}

export async function createDecompressionActivity(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.execute(_rawSql`INSERT INTO decompression_activities (company_id, title, description, category, type, duration_minutes, tone, content, cover_image_url, is_active, order_index, created_by) VALUES (${data.companyId ?? null}, ${data.title}, ${data.description ?? ''}, ${data.category ?? ''}, ${data.type ?? 'breathing'}, ${data.durationMinutes ?? 5}, ${data.tone ?? 'calm'}, ${JSON.stringify(data.content ?? {})}, ${data.coverImageUrl ?? null}, ${data.isActive ?? 1}, ${data.orderIndex ?? 0}, ${data.createdBy ?? null})`);
  const rr: any = await db.execute(_rawSql`SELECT LAST_INSERT_ID() as id`);
  return Number((rr as any)[0]?.[0]?.id ?? 0);
}

export async function updateDecompressionActivity(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  const fields: string[] = [];
  const vals: any[] = [];
  if (data.title !== undefined) { fields.push('title=?'); vals.push(data.title); }
  if (data.description !== undefined) { fields.push('description=?'); vals.push(data.description); }
  if (data.category !== undefined) { fields.push('category=?'); vals.push(data.category); }
  if (data.type !== undefined) { fields.push('type=?'); vals.push(data.type); }
  if (data.durationMinutes !== undefined) { fields.push('duration_minutes=?'); vals.push(data.durationMinutes); }
  if (data.tone !== undefined) { fields.push('tone=?'); vals.push(data.tone); }
  if (data.content !== undefined) { fields.push('content=?'); vals.push(JSON.stringify(data.content)); }
  if (data.coverImageUrl !== undefined) { fields.push('cover_image_url=?'); vals.push(data.coverImageUrl); }
  if (data.isActive !== undefined) { fields.push('is_active=?'); vals.push(data.isActive ? 1 : 0); }
  if (data.orderIndex !== undefined) { fields.push('order_index=?'); vals.push(data.orderIndex); }
  if (fields.length === 0) return;
  vals.push(id);
  const sql = `UPDATE decompression_activities SET ${fields.join(', ')} WHERE id=?`;
  await db.execute({ sql, values: vals } as any);
}

export async function deleteDecompressionActivity(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(_rawSql`DELETE FROM decompression_activities WHERE id=${id}`);
}

export async function listAISurveyGenerationsForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(_rawSql`SELECT id, topic, survey_type AS surveyType, status, progress_percent AS progressPercent, generated_survey_id AS generatedSurveyId, created_at AS createdAt FROM ai_survey_generations WHERE company_id=${companyId} ORDER BY id DESC LIMIT 20`);
  return ((r as any)[0] || []) as any[];
}

export async function listAIDecompressionGenerationsForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(_rawSql`SELECT id, theme, duration_minutes AS durationMinutes, status, progress_percent AS progressPercent, generated_activity_id AS generatedActivityId, created_at AS createdAt FROM ai_decompression_generations WHERE company_id=${companyId} ORDER BY id DESC LIMIT 20`);
  return ((r as any)[0] || []) as any[];
}


// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: HIERARCHY TREE (Empresa -> Filial -> Setor -> Colaboradores)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Returns the full hierarchy tree for a company (or all companies if null).
 * Shape: [{ company, branches: [{ branch, sectors: [{ sector, users: [...] }] }] }]
 * Each user includes course/survey/lastAccess stats so the UI can render counters.
 */
export async function getHierarchyTreeForCompany(companyId: number | null) {
  const db = await getDb();
  if (!db) return [];

  // 1) Companies (scope)
  const companiesRows = companyId
    ? await db.select().from(companies).where(eq(companies.id, companyId))
    : await db.select().from(companies);

  if (!companiesRows.length) return [];

  const companyIds = companiesRows.map((c) => c.id);
  const companyIdsCsv = companyIds.join(",");

  const branchesRaw = await db.execute(
    sql.raw(`SELECT id, company_id AS companyId, name, city, state, is_active AS isActive
             FROM branches WHERE company_id IN (${companyIdsCsv}) ORDER BY name`)
  );
  const branchesRows = Array.isArray((branchesRaw as any)[0]) ? (branchesRaw as any)[0] : Array.isArray(branchesRaw) ? branchesRaw : [];

  const sectorsRaw = await db.execute(
    sql.raw(`SELECT id, company_id AS companyId, branch_id AS branchId, name, is_active AS isActive
             FROM sectors WHERE company_id IN (${companyIdsCsv}) ORDER BY name`)
  );
  const sectorsRows = Array.isArray((sectorsRaw as any)[0]) ? (sectorsRaw as any)[0] : Array.isArray(sectorsRaw) ? sectorsRaw : [];

  const usersRaw = await db.execute(
    sql.raw(`SELECT u.id, u.name, u.email, u.role, u.lastSignedIn,
                    u.company_id AS companyId, u.branch_id AS branchId, u.sector_id AS sectorId,
                    ce.employeeName AS cargoName,
                    (SELECT COUNT(*) FROM user_progress p WHERE p.userId = u.id) AS coursesStarted,
                    (SELECT COUNT(*) FROM user_progress p WHERE p.userId = u.id AND p.isCompleted = 1) AS coursesCompleted,
                    (SELECT COUNT(*) FROM survey_responses r WHERE r.user_id = u.id) AS surveysAnswered,
                    (SELECT COUNT(*) FROM certificates c WHERE c.userId = u.id) AS certificatesCount,
                    (SELECT wi.score FROM wellbeing_index wi WHERE wi.user_id = u.id ORDER BY wi.snapshot_month DESC LIMIT 1) AS wellbeingScore
             FROM users u
             LEFT JOIN corporate_emails ce ON ce.userId = u.id
             WHERE u.company_id IN (${companyIdsCsv}) AND u.is_active = 1
             ORDER BY u.name`)
  );
  const usersRows = Array.isArray((usersRaw as any)[0]) ? (usersRaw as any)[0] : Array.isArray(usersRaw) ? usersRaw : [];

  const modulesRaw = await db.execute(
    sql.raw(`SELECT COUNT(*) AS total FROM modules WHERE isActive = 1`)
  );
  const totalModules = Number(_rows(modulesRaw)[0]?.total ?? 0);

  const surveysCountRaw = await db.execute(
    sql.raw(`SELECT company_id AS companyId, COUNT(*) AS total
             FROM surveys WHERE company_id IN (${companyIdsCsv}) AND status = 'active'
             GROUP BY company_id`)
  );
  const surveysCountByCompany = new Map<number, number>();
  for (const row of _rows(surveysCountRaw)) {
    surveysCountByCompany.set(Number(row.companyId), Number(row.total));
  }

  const usersByBranch = new Map<string, any[]>();
  for (const u of usersRows as any[]) {
    const key = `${u.companyId}:${u.branchId ?? 0}:${u.sectorId ?? 0}`;
    if (!usersByBranch.has(key)) usersByBranch.set(key, []);
    usersByBranch.get(key)!.push(u);
  }

  const tree = companiesRows.map((co) => {
    const cBranches = (branchesRows as any[]).filter((b: any) => Number(b.companyId) === co.id);
    const cSectors = (sectorsRows as any[]).filter((s: any) => Number(s.companyId) === co.id);
    const totalSurveys = surveysCountByCompany.get(co.id) ?? 0;

    const branchNodes = cBranches.map((b: any) => {
      const bSectors = cSectors.filter((s: any) => Number(s.branchId) === Number(b.id));
      const sectorNodes: any[] = bSectors.map((s: any) => {
        const sUsers = (usersByBranch.get(`${co.id}:${b.id}:${s.id}`) ?? []).map((u: any) =>
          formatUserStatsRow(u, totalModules, totalSurveys)
        );
        return {
          sector: { id: Number(s.id), name: s.name, branchId: Number(b.id), companyId: co.id },
          userCount: sUsers.length,
          users: sUsers,
        };
      });
      const orphanUsers = (usersByBranch.get(`${co.id}:${b.id}:0`) ?? []).map((u: any) =>
        formatUserStatsRow(u, totalModules, totalSurveys)
      );
      if (orphanUsers.length) {
        sectorNodes.push({
          sector: { id: 0, name: "Sem setor", branchId: Number(b.id), companyId: co.id },
          userCount: orphanUsers.length,
          users: orphanUsers,
        });
      }
      const totalUsers = sectorNodes.reduce((acc, s) => acc + s.userCount, 0);
      return {
        branch: { id: Number(b.id), name: b.name, city: b.city, state: b.state, companyId: co.id },
        userCount: totalUsers,
        sectors: sectorNodes,
      };
    });

    // Orphan users (no branch)
    const noBranchUsersBySector = new Map<number, any[]>();
    for (const [key, list] of usersByBranch.entries()) {
      const [cid, bid, sid] = key.split(":").map((v) => Number(v));
      if (cid !== co.id || bid !== 0) continue;
      noBranchUsersBySector.set(sid, list);
    }
    if (noBranchUsersBySector.size) {
      const orphanSectorNodes: any[] = [];
      for (const [sid, list] of noBranchUsersBySector.entries()) {
        const sectorInfo =
          sid === 0
            ? { id: 0, name: "Sem setor", branchId: 0, companyId: co.id }
            : (() => {
                const s = (cSectors as any[]).find((x: any) => Number(x.id) === sid);
                return s
                  ? { id: Number(s.id), name: s.name, branchId: 0, companyId: co.id }
                  : { id: 0, name: "Sem setor", branchId: 0, companyId: co.id };
              })();
        const fmt = list.map((u: any) => formatUserStatsRow(u, totalModules, totalSurveys));
        orphanSectorNodes.push({ sector: sectorInfo, userCount: fmt.length, users: fmt });
      }
      const total = orphanSectorNodes.reduce((acc, s) => acc + s.userCount, 0);
      branchNodes.push({
        branch: { id: 0, name: "Sem filial", city: null, state: null, companyId: co.id },
        userCount: total,
        sectors: orphanSectorNodes,
      });
    }

    const companyUserCount = branchNodes.reduce((acc, b) => acc + b.userCount, 0);
    return {
      company: {
        id: co.id,
        name: co.name,
        cnpj: co.cnpj ?? null,
        logoUrl: (co as any).logoUrl ?? null,
      },
      userCount: companyUserCount,
      branchCount: branchNodes.length,
      totalModules,
      totalSurveys,
      branches: branchNodes,
    };
  });

  return tree;
}

function formatUserStatsRow(u: any, totalModules: number, totalSurveys: number) {
  const coursesCompleted = Number(u.coursesCompleted) || 0;
  const completionPercent = totalModules > 0 ? Math.round((coursesCompleted / totalModules) * 100) : 0;
  return {
    id: Number(u.id),
    name: u.name || u.cargoName || "(sem nome)",
    email: u.email,
    role: u.role,
    branchId: u.branchId != null ? Number(u.branchId) : null,
    sectorId: u.sectorId != null ? Number(u.sectorId) : null,
    cargo: u.cargoName ?? null,
    lastSignedIn: u.lastSignedIn,
    coursesStarted: Number(u.coursesStarted) || 0,
    coursesCompleted,
    coursesTotal: totalModules,
    completionPercent,
    surveysAnswered: Number(u.surveysAnswered) || 0,
    surveysTotal: totalSurveys,
    certificatesCount: Number(u.certificatesCount) || 0,
    wellbeingScore: u.wellbeingScore != null ? Number(u.wellbeingScore) : null,
  };
}

/** Detailed view of a single user — full course progress, surveys answered, certs. */
export async function getUserFullDetails(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const u = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = u[0];
  if (!user) return null;

  const ce = await db
    .select()
    .from(corporateEmails)
    .where(eq(corporateEmails.userId, userId))
    .limit(1);

  const progressRows = await db.execute(
    sql.raw(`SELECT p.moduleId, p.percentWatched, p.isCompleted, p.completedAt, p.lastWatchedAt,
                    m.title AS moduleTitle, m.durationMinutes AS durationMinutes
             FROM user_progress p
             JOIN modules m ON m.id = p.moduleId
             WHERE p.userId = ${userId}
             ORDER BY p.lastWatchedAt DESC`)
  );
  const courses = _rows(progressRows);

  const surveysRows = await db.execute(
    sql.raw(`SELECT r.survey_id AS surveyId, r.submitted_at AS submittedAt, s.title AS surveyTitle
             FROM survey_responses r
             JOIN surveys s ON s.id = r.survey_id
             WHERE r.user_id = ${userId}
             ORDER BY r.submitted_at DESC`)
  );
  const surveys = _rows(surveysRows);

  const certRows = await db.execute(
    sql.raw(`SELECT c.id, c.certificateCode, c.issuedAt, c.expires_at AS expiresAt,
                    m.title AS moduleTitle
             FROM certificates c
             JOIN modules m ON m.id = c.moduleId
             WHERE c.userId = ${userId}
             ORDER BY c.issuedAt DESC`)
  );
  const certs = _rows(certRows);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastSignedIn: user.lastSignedIn,
      companyId: (user as any).companyId ?? null,
      branchId: (user as any).branchId ?? null,
      sectorId: (user as any).sectorId ?? null,
      cargo: ce[0]?.employeeName ?? null,
    },
    courses: courses.map((c: any) => ({
      moduleId: Number(c.moduleId),
      moduleTitle: c.moduleTitle,
      percentWatched: Number(c.percentWatched) || 0,
      isCompleted: !!c.isCompleted,
      completedAt: c.completedAt,
      lastWatchedAt: c.lastWatchedAt,
      durationMinutes: Number(c.durationMinutes) || 0,
    })),
    surveys: surveys.map((s: any) => ({
      surveyId: Number(s.surveyId),
      surveyTitle: s.surveyTitle,
      submittedAt: s.submittedAt,
    })),
    certificates: certs.map((c: any) => ({
      id: Number(c.id),
      certificateCode: c.certificateCode,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      moduleTitle: c.moduleTitle,
    })),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// VISÃO 360º DO COLABORADOR — wellbeing / care helpers
// ═════════════════════════════════════════════════════════════════════════════

function _rows(raw: any): any[] {
  if (Array.isArray((raw as any)[0])) return (raw as any)[0];
  if (Array.isArray(raw)) return raw;
  return [];
}

// Maps a 0-100 score to a semantic status. Higher score = better wellbeing.
function _statusFromScore(score: number): { label: string; severity: string } {
  if (score >= 80) return { label: "Saudável · em equilíbrio", severity: "bom" };
  if (score >= 60) return { label: "Atenção · risco moderado", severity: "moderado" };
  if (score >= 40) return { label: "Alerta · risco elevado", severity: "alto" };
  return { label: "Crítico · intervenção urgente", severity: "critico" };
}

/**
 * Recomputes the wellbeing index for a user from raw signals and stores a
 * snapshot for the current month. The score is intentionally simple and
 * explainable: we start from 100 and subtract weighted penalties per signal
 * severity, so health/psychology professionals can trace exactly why a score
 * moved. Returns the stored snapshot row shape.
 */
export async function computeWellbeingIndex(userId: number, companyId: number | null) {
  const db = await getDb();
  if (!db) return null;

  const sigRaw = await db.execute(
    sql.raw(`SELECT signal_type, value, weight, severity FROM wellbeing_signals
             WHERE user_id = ${userId}
             ORDER BY recorded_at DESC`)
  );
  const signals = _rows(sigRaw);

  // Keep only the most recent signal of each type so older readings don't
  // double-penalize the same dimension.
  const latestByType = new Map<string, any>();
  for (const s of signals) if (!latestByType.has(s.signal_type)) latestByType.set(s.signal_type, s);

  const severityPenalty: Record<string, number> = { baixo: 0, moderado: 12, alto: 22, critico: 35 };
  let score = 100;
  for (const s of latestByType.values()) {
    const base = severityPenalty[String(s.severity)] ?? 0;
    score -= base * (Number(s.weight) || 1);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Burnout risk derives from the nr01 + workload + mood signals primarily.
  const worst = [...latestByType.values()].reduce((acc, s) => {
    const order = ["baixo", "moderado", "alto", "critico"];
    return order.indexOf(s.severity) > order.indexOf(acc) ? s.severity : acc;
  }, "baixo");
  const burnoutRisk = score < 40 ? "critico" : score < 60 ? "alto" : score < 80 ? "moderado" : "baixo";

  const workloadSig = latestByType.get("workload");
  const workloadLevel = workloadSig
    ? ({ baixo: "baixa", moderado: "media", alto: "alta", critico: "critica" } as any)[workloadSig.severity]
    : null;
  const engSig = latestByType.get("engagement");
  const engagementPct = engSig?.value != null ? Math.round(Number(engSig.value)) : null;

  // Trend: compare to the previous month snapshot if it exists.
  const prevRaw = await db.execute(
    sql.raw(`SELECT score FROM wellbeing_index WHERE user_id = ${userId}
             ORDER BY snapshot_month DESC LIMIT 1`)
  );
  const prev = _rows(prevRaw)[0];
  let trend = "estavel";
  if (prev) {
    if (score > Number(prev.score) + 2) trend = "subindo";
    else if (score < Number(prev.score) - 2) trend = "caindo";
  }

  const st = _statusFromScore(score);
  const cid = companyId ?? "NULL";

  await db.execute(
    sql.raw(`INSERT INTO wellbeing_index
      (user_id, company_id, score, burnout_risk, workload_level, engagement_pct, days_without_leave, trend, status_label, snapshot_month)
      VALUES (${userId}, ${cid}, ${score}, '${burnoutRisk}',
        ${workloadLevel ? `'${workloadLevel}'` : "NULL"},
        ${engagementPct ?? "NULL"},
        NULL, '${trend}', ${db ? `'${st.label.replace(/'/g, "''")}'` : "NULL"},
        DATE_FORMAT(CURDATE(), '%Y-%m-01'))`)
  );

  return { score, burnoutRisk, workloadLevel, engagementPct, trend, statusLabel: st.label, worst };
}

/**
 * Builds an intelligent, actionable alert from the index + signals. This is the
 * differential of the screen: instead of just showing numbers, it interprets
 * the trend and fires a recommendation. Returns null when nothing needs attention.
 */
function _buildAlert(index: any, signals: any[]): any | null {
  if (!index) return null;
  const score = Number(index.score);
  const trend = index.trend;
  const burnout = index.burnout_risk;

  const hasHighNr01 = signals.some((s) => s.signal_type === "nr01_result" && ["alto", "critico"].includes(s.severity));
  const moodFalling = signals.some((s) => s.signal_type === "mood_trend" && ["alto", "critico"].includes(s.severity));
  const highWorkload = signals.some((s) => s.signal_type === "workload" && ["alto", "critico"].includes(s.severity));

  if (burnout === "critico" || score < 40) {
    return {
      level: "critico",
      title: "Risco crítico de burnout detectado",
      message:
        "A combinação de carga elevada, queda do índice de bem-estar e sinais recentes indica esgotamento iminente. Recomenda-se contato imediato da equipe de saúde.",
      actions: ["Roteiro de conversa", "Protocolo NR-01", "Agendar conversa"],
    };
  }
  if ((burnout === "alto" || (trend === "caindo" && (hasHighNr01 || moodFalling || highWorkload)))) {
    return {
      level: "alto",
      title: "Sinal precoce de burnout detectado",
      message:
        "O índice de bem-estar vem caindo nas últimas semanas, acompanhado de sinais de sobrecarga. Uma intervenção preventiva agora tende a reverter o quadro.",
      actions: ["Roteiro de conversa", "Protocolo NR-01"],
    };
  }
  if (trend === "caindo") {
    return {
      level: "moderado",
      title: "Atenção: tendência de queda no bem-estar",
      message:
        "Pequenas oscilações negativas foram identificadas. Vale uma conversa de acompanhamento e reforço das técnicas já aplicadas.",
      actions: ["Agendar conversa"],
    };
  }
  if (burnout === "moderado") {
    // Score still in the attention band, but trend is stable/improving — frame
    // it as consolidating progress rather than as a new warning.
    return {
      level: "moderado",
      title: "Acompanhamento em curso · evolução positiva",
      message:
        "O colaborador permanece na faixa de atenção, mas a tendência é de melhora. Manter as técnicas em andamento e acompanhar de perto consolida a recuperação.",
      actions: ["Agendar conversa"],
    };
  }
  return null;
}

/**
 * Full 360º view of a collaborator: identity, computed wellbeing index, 6-month
 * history, intelligent alert, care journey, interventions and leave history.
 * LGPD: this returns individual-level sensitive data; callers MUST enforce that
 * the requester is an authorized health/psychology/admin profile and belongs to
 * the same company.
 */
export async function getCollaborator360(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const base = await getUserFullDetails(userId);
  if (!base) return null;
  const companyId = base.user.companyId ?? null;

  // Identity enrichment: unit (branch), sector, company, tenure.
  let unit: any = null;
  let sectorName: string | null = null;
  let companyName: string | null = null;
  if (base.user.branchId) {
    const bRaw = await db.execute(
      sql.raw(`SELECT name, city, state FROM branches WHERE id = ${base.user.branchId} LIMIT 1`)
    );
    unit = _rows(bRaw)[0] ?? null;
  }
  if (base.user.sectorId) {
    const sRaw = await db.execute(sql.raw(`SELECT name FROM sectors WHERE id = ${base.user.sectorId} LIMIT 1`));
    sectorName = _rows(sRaw)[0]?.name ?? null;
  }
  if (companyId) {
    const cRaw = await db.execute(sql.raw(`SELECT name FROM companies WHERE id = ${companyId} LIMIT 1`));
    companyName = _rows(cRaw)[0]?.name ?? null;
  }

  // Wellbeing index history (last 6 monthly snapshots, oldest→newest for charting).
  const idxRaw = await db.execute(
    sql.raw(`SELECT score, burnout_risk, workload_level, engagement_pct, days_without_leave,
                    trend, status_label, snapshot_month
             FROM wellbeing_index WHERE user_id = ${userId}
             ORDER BY snapshot_month DESC LIMIT 6`)
  );
  const idxHistDesc = _rows(idxRaw);
  const current = idxHistDesc[0] ?? null;
  const history = [...idxHistDesc].reverse().map((r) => ({
    month: r.snapshot_month,
    score: Number(r.score),
  }));

  // days_without_leave: prefer stored, else compute from last leave end_date.
  let daysWithoutLeave: number | null = current?.days_without_leave ?? null;

  const sigRaw = await db.execute(
    sql.raw(`SELECT signal_type, value, weight, severity, label, source, recorded_at
             FROM wellbeing_signals WHERE user_id = ${userId}
             ORDER BY recorded_at DESC`)
  );
  const signals = _rows(sigRaw);

  const journeyRaw = await db.execute(
    sql.raw(`SELECT id, event_type, title, description, status, event_date
             FROM care_journey_events WHERE user_id = ${userId}
             ORDER BY event_date DESC, id DESC`)
  );
  const journey = _rows(journeyRaw).map((e) => ({
    id: Number(e.id),
    type: e.event_type,
    title: e.title,
    description: e.description,
    status: e.status,
    date: e.event_date,
  }));

  const intRaw = await db.execute(
    sql.raw(`SELECT id, technique, category, notes, status, started_at
             FROM care_interventions WHERE user_id = ${userId}
             ORDER BY created_at DESC`)
  );
  const interventionsAll = _rows(intRaw);
  const interventions = interventionsAll
    .filter((i) => i.status !== "sugerida")
    .map((i) => ({ id: Number(i.id), technique: i.technique, status: i.status, startedAt: i.started_at }));
  const nextSteps = interventionsAll
    .filter((i) => i.status === "sugerida")
    .map((i) => ({ id: Number(i.id), technique: i.technique, notes: i.notes }));

  const leaveRaw = await db.execute(
    sql.raw(`SELECT id, start_date, end_date, days, reason, cid_group
             FROM leave_history WHERE user_id = ${userId}
             ORDER BY start_date DESC`)
  );
  const leaves = _rows(leaveRaw).map((l) => ({
    id: Number(l.id),
    startDate: l.start_date,
    endDate: l.end_date,
    days: l.days != null ? Number(l.days) : null,
    reason: l.reason,
    cidGroup: l.cid_group,
  }));

  if (daysWithoutLeave == null) {
    const lastEnd = leaves.map((l) => l.endDate).filter(Boolean).sort().reverse()[0];
    if (lastEnd) {
      const diff = Math.floor((Date.now() - new Date(lastEnd).getTime()) / 86400000);
      daysWithoutLeave = diff >= 0 ? diff : null;
    }
  }

  const alert = _buildAlert(current, signals);

  const score = current ? Number(current.score) : null;
  const st = score != null ? _statusFromScore(score) : { label: "Sem dados", severity: "neutro" };

  return {
    user: {
      ...base.user,
      sectorName,
      companyName,
      unitName: unit?.name ?? null,
      unitCity: unit?.city ?? null,
      unitState: unit?.state ?? null,
    },
    index: {
      score,
      statusLabel: current?.status_label ?? st.label,
      severity: st.severity,
      burnoutRisk: current?.burnout_risk ?? null,
      workloadLevel: current?.workload_level ?? null,
      engagementPct: current?.engagement_pct != null ? Number(current.engagement_pct) : null,
      daysWithoutLeave,
      trend: current?.trend ?? null,
    },
    history,
    alert,
    signals: signals.map((s) => ({
      type: s.signal_type,
      severity: s.severity,
      label: s.label,
      value: s.value != null ? Number(s.value) : null,
      recordedAt: s.recorded_at,
    })),
    journey,
    interventions,
    nextSteps,
    leaves,
    courses: base.courses,
    surveys: base.surveys,
    certificates: base.certificates,
  };
}

export async function addCareIntervention(opts: {
  userId: number;
  companyId: number | null;
  technique: string;
  notes?: string | null;
  status?: string;
  createdByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const status = opts.status ?? "aplicada";
  const cid = opts.companyId ?? "NULL";
  const notes = opts.notes ? `'${String(opts.notes).replace(/'/g, "''")}'` : "NULL";
  const tech = String(opts.technique).replace(/'/g, "''");
  const by = opts.createdByUserId ?? "NULL";
  const startedAt = status === "sugerida" ? "NULL" : "CURDATE()";
  await db.execute(
    sql.raw(`INSERT INTO care_interventions (user_id, company_id, technique, category, notes, status, started_at, created_by_user_id)
             VALUES (${opts.userId}, ${cid}, '${tech}', '${status === "sugerida" ? "sugerida" : "aplicada"}', ${notes}, '${status}', ${startedAt}, ${by})`)
  );
  // Record on the journey too so the timeline reflects the action.
  if (status !== "sugerida") {
    await db.execute(
      sql.raw(`INSERT INTO care_journey_events (user_id, company_id, event_type, title, description, status, event_date, created_by_user_id)
               VALUES (${opts.userId}, ${cid}, 'intervention', 'Nova intervenção: ${tech}', ${notes}, 'concluido', CURDATE(), ${by})`)
    );
  }
  return { ok: true };
}

export async function scheduleCareConversation(opts: {
  userId: number;
  companyId: number | null;
  title?: string | null;
  description?: string | null;
  eventDate: string; // YYYY-MM-DD
  createdByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) return null;
  const cid = opts.companyId ?? "NULL";
  const title = (opts.title || "Conversa de acompanhamento").replace(/'/g, "''");
  const desc = opts.description ? `'${String(opts.description).replace(/'/g, "''")}'` : "NULL";
  const by = opts.createdByUserId ?? "NULL";
  const date = String(opts.eventDate).replace(/[^0-9-]/g, "");
  await db.execute(
    sql.raw(`INSERT INTO care_journey_events (user_id, company_id, event_type, title, description, status, event_date, created_by_user_id)
             VALUES (${opts.userId}, ${cid}, 'conversation', '${title}', ${desc}, 'agendado', '${date}', ${by})`)
  );
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: EMAIL CAMPAIGN HELPERS
// ═════════════════════════════════════════════════════════════════════════════

export async function previewCampaignRecipients(opts: {
  companyId: number;
  campaignType: "course_pending" | "survey_pending";
  targetModuleId?: number;
  targetSurveyId?: number;
  branchId?: number | null;
  sectorId?: number | null;
  maxCompletionPercent?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const where: string[] = [`u.company_id = ${opts.companyId}`];
  if (opts.branchId != null) where.push(`u.branch_id = ${opts.branchId}`);
  if (opts.sectorId != null) where.push(`u.sector_id = ${opts.sectorId}`);
  where.push(`u.email IS NOT NULL AND u.email <> ''`);

  let query = "";
  if (opts.campaignType === "course_pending") {
    if (!opts.targetModuleId) return [];
    const max = opts.maxCompletionPercent ?? 100;
    query = `
      SELECT u.id AS userId, u.name, u.email,
             COALESCE(p.percentWatched, 0) AS percentWatched,
             COALESCE(p.isCompleted, 0) AS isCompleted
      FROM users u
      LEFT JOIN user_progress p ON p.userId = u.id AND p.moduleId = ${opts.targetModuleId}
      WHERE ${where.join(" AND ")}
        AND (p.isCompleted IS NULL OR p.isCompleted = 0)
        AND (p.percentWatched IS NULL OR p.percentWatched < ${max})
      ORDER BY u.name
    `;
  } else if (opts.campaignType === "survey_pending") {
    if (!opts.targetSurveyId) return [];
    query = `
      SELECT u.id AS userId, u.name, u.email
      FROM users u
      WHERE ${where.join(" AND ")}
        AND NOT EXISTS (
          SELECT 1 FROM survey_responses r
          WHERE r.user_id = u.id AND r.survey_id = ${opts.targetSurveyId}
        )
      ORDER BY u.name
    `;
  } else {
    return [];
  }
  const raw = await db.execute(sql.raw(query));
  return _rows(raw).map((r: any) => ({
    userId: Number(r.userId),
    name: r.name,
    email: r.email,
    percentWatched: r.percentWatched != null ? Number(r.percentWatched) : null,
  }));
}

export async function listEmailCampaigns(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const raw = await db.execute(
    sql.raw(`SELECT id, name, campaign_type AS campaignType, status,
                    total_recipients AS totalRecipients,
                    sent_count AS sentCount, failed_count AS failedCount,
                    target_module_id AS targetModuleId, target_survey_id AS targetSurveyId,
                    schedule_type AS scheduleType, scheduled_at AS scheduledAt,
                    created_at AS createdAt, sent_at AS sentAt
             FROM email_campaigns
             WHERE company_id = ${companyId}
             ORDER BY id DESC LIMIT 200`)
  );
  return _rows(raw);
}

function mysqlString(v: string | null | undefined): string {
  if (v == null) return "NULL";
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

export async function createEmailCampaign(data: {
  companyId: number;
  createdByUserId: number;
  name: string;
  campaignType: string;
  targetModuleId?: number | null;
  targetSurveyId?: number | null;
  filterJson?: any;
  emailSubject: string;
  emailBody: string;
  scheduleType: string;
  scheduledAt?: Date | null;
  recurringCron?: string | null;
  recipients: { userId: number; email: string; name?: string | null }[];
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const filterStr = data.filterJson != null ? JSON.stringify(data.filterJson) : null;
  const insert = await db.execute(
    sql`INSERT INTO email_campaigns
        (company_id, created_by_user_id, name, campaign_type, target_module_id, target_survey_id,
         filter_json, email_subject, email_body, schedule_type, scheduled_at, recurring_cron,
         status, total_recipients)
        VALUES
        (${data.companyId}, ${data.createdByUserId}, ${data.name}, ${data.campaignType},
         ${data.targetModuleId ?? null}, ${data.targetSurveyId ?? null},
         ${filterStr}, ${data.emailSubject}, ${data.emailBody}, ${data.scheduleType},
         ${data.scheduledAt ?? null}, ${data.recurringCron ?? null},
         'draft', ${data.recipients.length})`
  );
  const id = Number((insert as any)[0]?.insertId ?? (insert as any).insertId ?? 0);
  if (!id) throw new Error("Failed to insert campaign");
  if (data.recipients.length > 0) {
    const values = data.recipients
      .map(
        (r) =>
          `(${id}, ${r.userId}, ${mysqlString(r.email)}, ${mysqlString(r.name ?? null)}, 'pending')`
      )
      .join(",");
    await db.execute(
      sql.raw(
        `INSERT INTO email_campaign_recipients (campaign_id, user_id, email, name, status) VALUES ${values}`
      )
    );
  }
  return id;
}

export async function getEmailCampaign(id: number) {
  const db = await getDb();
  if (!db) return null;
  const raw = await db.execute(
    sql.raw(`SELECT id, company_id AS companyId, created_by_user_id AS createdByUserId,
                    name, campaign_type AS campaignType,
                    target_module_id AS targetModuleId, target_survey_id AS targetSurveyId,
                    filter_json AS filterJson, email_subject AS emailSubject, email_body AS emailBody,
                    schedule_type AS scheduleType, scheduled_at AS scheduledAt,
                    recurring_cron AS recurringCron, status,
                    total_recipients AS totalRecipients,
                    sent_count AS sentCount, failed_count AS failedCount,
                    created_at AS createdAt, sent_at AS sentAt
             FROM email_campaigns WHERE id = ${id} LIMIT 1`)
  );
  const rows = _rows(raw);
  if (!rows.length) return null;
  const c = rows[0];

  const rcpRaw = await db.execute(
    sql.raw(`SELECT id, user_id AS userId, email, name, status,
                    sent_at AS sentAt, error
             FROM email_campaign_recipients
             WHERE campaign_id = ${id}
             ORDER BY id`)
  );
  const recipients = _rows(rcpRaw);
  return { campaign: c, recipients };
}

export async function updateEmailCampaignStatus(id: number, status: string, setSentAt = false) {
  const db = await getDb();
  if (!db) return;
  if (setSentAt) {
    await db.execute(
      sql.raw(`UPDATE email_campaigns SET status = '${status}', sent_at = NOW() WHERE id = ${id}`)
    );
  } else {
    await db.execute(
      sql.raw(`UPDATE email_campaigns SET status = '${status}' WHERE id = ${id}`)
    );
  }
}

export async function bumpEmailCampaignCounters(
  id: number,
  delta: { sent?: number; failed?: number }
) {
  const db = await getDb();
  if (!db) return;
  const parts: string[] = [];
  if (delta.sent) parts.push(`sent_count = sent_count + ${delta.sent}`);
  if (delta.failed) parts.push(`failed_count = failed_count + ${delta.failed}`);
  if (!parts.length) return;
  await db.execute(
    sql.raw(`UPDATE email_campaigns SET ${parts.join(", ")} WHERE id = ${id}`)
  );
}

export async function updateEmailCampaignRecipient(
  recipientId: number,
  status: string,
  error?: string | null
) {
  const db = await getDb();
  if (!db) return;
  const errSql = error ? mysqlString(error) : "NULL";
  await db.execute(
    sql.raw(
      `UPDATE email_campaign_recipients
       SET status = '${status}', sent_at = NOW(), error = ${errSql}
       WHERE id = ${recipientId}`
    )
  );
}

export async function getModulesForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const raw = await db.execute(
    sql.raw(`SELECT DISTINCT m.id, m.title, m.orderIndex
             FROM modules m
             WHERE m.isActive = 1
               AND (m.created_by_company_id = ${companyId}
                    OR EXISTS (
                      SELECT 1 FROM company_content_enrollments ce
                      WHERE ce.company_id = ${companyId}
                        AND ce.content_type = 'module'
                        AND ce.content_id = m.id
                        AND ce.is_active = 1))
             ORDER BY m.orderIndex, m.id`)
  );
  return _rows(raw);
}

export async function getSurveysForCompanyShort(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const raw = await db.execute(
    sql.raw(`SELECT id, title, status FROM surveys
             WHERE company_id = ${companyId}
             ORDER BY id DESC`)
  );
  return _rows(raw);
}



