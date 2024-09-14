export default function sortCriteriaGenerator(
  accessor: (obj: any) => string | number,
  { asc = true, desc = false }
) {
  return (a: any, b: any) => {
    const textA = accessor(a);
    const textB = accessor(b);
    if (typeof textA === "number" && typeof textB === "number") {
      return asc && !desc ? textA - textB : textB - textA;
    }
    if (typeof textA === "string" && typeof textB === "string") {
      return asc && !desc
        ? textA.localeCompare(textB)
        : textB.localeCompare(textA);
    }
    throw new Error("Invalid type");
  };
}
