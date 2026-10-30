import type { NodeObject } from "./node";
import type { Side } from "./geometry";

/**
 * جسر بين عناصر التحكم اللي جوه كلاس العقدة وبين متحكّم الرسم التخطيطي
 * (الموجود على مستوى الكانفا). العقدة نفسها ما تعرفش حاجة عن الروابط:
 * بس بتبلّغ لما المستخدم يسحب من نقطة الربط.
 */
export interface ConnectHandlers {
  start(node: NodeObject, side: Side, event: Event): void;
  move(node: NodeObject, side: Side, x: number, y: number): void;
  end(node: NodeObject, side: Side): void;
}

export const nodeBridge: { handlers: ConnectHandlers | null } = {
  handlers: null,
};

/** نفس الفكرة لسحب أطراف الرابط (ننقل الطرف لعقدة تانية أو نحرره). */
export interface ConnectorHandlers {
  drag(
    connector: import("./connector").ConnectorObject,
    which: "start" | "end",
    point: { x: number; y: number }
  ): boolean;
  release(
    connector: import("./connector").ConnectorObject,
    which: "start" | "end"
  ): void;
}

export const connectorBridge: { handlers: ConnectorHandlers | null } = {
  handlers: null,
};
