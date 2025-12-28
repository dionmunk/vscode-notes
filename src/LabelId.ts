export const NONE_LABEL_ID = Symbol("NONE_LABEL_ID");
export const ANY_LABEL_ID = Symbol("ANY_LABEL_ID");
export type NoteLabelId = { name: string, ancestors: string[] };

type LabelId = NoteLabelId | typeof NONE_LABEL_ID | typeof ANY_LABEL_ID;

  export default LabelId;