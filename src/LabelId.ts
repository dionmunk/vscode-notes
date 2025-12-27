export const NONE_LABEL_ID = Symbol("NONE_LABEL_ID");
export const ANY_LABEL_ID = Symbol("ANY_LABEL_ID");

type LabelId = { name: string, ancestors: string[] } |
  typeof NONE_LABEL_ID |
  typeof ANY_LABEL_ID;

  export default LabelId;