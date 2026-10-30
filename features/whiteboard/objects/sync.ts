import * as fabric from "fabric";
import { isConnector } from "./connector";
import { getNodeId } from "./factory";
import { MIN_NODE_HEIGHT, MIN_NODE_WIDTH, NodeObject, isNode } from "./node";

/** كل الكائنات بما فيها اللي جوه مجموعات (بدون ActiveSelection). */
export function flattenObjects(objects: fabric.FabricObject[]): fabric.FabricObject[] {
  const out: fabric.FabricObject[] = [];
  const visit = (list: fabric.FabricObject[]) => {
    for (const obj of list) {
      out.push(obj);
      if (obj instanceof fabric.Group && !(obj instanceof fabric.ActiveSelection)) {
        visit(obj.getObjects());
      }
    }
  };
  visit(objects);
  return out;
}

/**
 * يظبط العقد (أبعاد دنيا، تحويل التمطيط لأبعاد حقيقية، ملاءمة النص) ثم يحسب
 * هندسة كل الروابط من أطرافها. بيشتغل قبل كل رسم في الكانفا الحية، وبيتنادى
 * يدويًا قبل تصدير صفحة على كانفا ثابتة.
 */
export function syncDiagramObjects(
  objects: fabric.FabricObject[],
  skip?: NodeObject | null
) {
  const flat = flattenObjects(objects);
  const byId = new Map<string, NodeObject>();
  for (const obj of flat) {
    if (!isNode(obj)) continue;
    byId.set(getNodeId(obj), obj);
    // أي تكبير بالسحب يتحوّل لتغيير أبعاد حقيقي (عشان النص ما يتمطّش)
    if (!obj.group && (Math.abs(obj.scaleX - 1) > 1e-3 || Math.abs(obj.scaleY - 1) > 1e-3)) {
      obj.set({
        width: obj.width * obj.scaleX,
        height: obj.height * obj.scaleY,
        scaleX: 1,
        scaleY: 1,
      });
    }
    if (obj !== skip) {
      if (obj.width < MIN_NODE_WIDTH || obj.height < MIN_NODE_HEIGHT) {
        obj.set({
          width: Math.max(obj.width, MIN_NODE_WIDTH),
          height: Math.max(obj.height, MIN_NODE_HEIGHT),
        });
      }
      obj.fitToText();
    }
    obj.setCoords();
  }
  for (const obj of flat) {
    if (isConnector(obj)) obj.refresh((id) => byId.get(id));
  }
}

/** اسم مختصر بيستخدمه التصدير على الكانفا الثابتة (نفس المزامنة الكاملة). */
export const syncConnectors = (objects: fabric.FabricObject[]) =>
  syncDiagramObjects(objects);
