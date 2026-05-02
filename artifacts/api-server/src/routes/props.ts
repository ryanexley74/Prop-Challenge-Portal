import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { propsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreatePropBody,
  CreatePropParams,
  UpdatePropBody,
  UpdatePropParams,
  DeletePropParams,
  ListPropsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// List props for a game
router.get("/games/:gameId/props", async (req, res) => {
  try {
    const { gameId } = ListPropsParams.parse(req.params);
    const props = await db.select().from(propsTable)
      .where(eq(propsTable.gameId, gameId))
      .orderBy(propsTable.order, propsTable.createdAt);
    res.json(props.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      resolvedAt: p.resolvedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list props");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a prop
router.post("/games/:gameId/props", async (req, res) => {
  try {
    const { gameId } = CreatePropParams.parse(req.params);
    const body = CreatePropBody.parse(req.body);

    // Get current max order for this game
    const existing = await db.select().from(propsTable).where(eq(propsTable.gameId, gameId));
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(p => p.order)) : -1;

    const [prop] = await db.insert(propsTable).values({
      gameId,
      question: body.question,
      type: body.type,
      threshold: body.threshold ?? null,
      order: body.order ?? maxOrder + 1,
    }).returning();

    res.status(201).json({
      ...prop,
      createdAt: prop.createdAt.toISOString(),
      resolvedAt: prop.resolvedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create prop");
    res.status(400).json({ error: "Bad request" });
  }
});

// Update / resolve a prop
router.patch("/props/:propId", async (req, res) => {
  try {
    const { propId } = UpdatePropParams.parse(req.params);
    const body = UpdatePropBody.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.result !== undefined) {
      updates.result = body.result;
      updates.resolvedAt = body.result !== null ? new Date() : null;
    }
    if (body.question !== undefined) updates.question = body.question;
    if (body.order !== undefined) updates.order = body.order;

    const [prop] = await db.update(propsTable)
      .set(updates)
      .where(eq(propsTable.id, propId))
      .returning();

    if (!prop) return res.status(404).json({ error: "Prop not found" });
    res.json({
      ...prop,
      createdAt: prop.createdAt.toISOString(),
      resolvedAt: prop.resolvedAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update prop");
    res.status(400).json({ error: "Bad request" });
  }
});

// Delete a prop
router.delete("/props/:propId", async (req, res) => {
  try {
    const { propId } = DeletePropParams.parse(req.params);
    await db.delete(propsTable).where(eq(propsTable.id, propId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete prop");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
