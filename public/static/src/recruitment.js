
export function filterOperators(data, filters, recruitmentStatus = true) {
  return data.filter(char => {
    // ✅ Recruitment logic
    if (recruitmentStatus === true) {
      if (char.recruitment === null) return false;
    }

    // ✅ ALL (AND) logic — all conditions must pass
    const all = filters.all || {};
    for (const key in all) {
      const value = all[key];
      if (Array.isArray(value)) {
        if (key === "tagList") {
          if (!value.every(v => char.tagList?.includes(v))) return false;
        } else if (key === "powers") {
          if (!value.every(v => char.powers?.includes(v))) return false;
        } else {
          if (!value.includes(char[key])) return false;
        }
      } else {
        if (key === "tagList") {
          if (!char.tagList?.includes(value)) return false;
        } else if (key === "powers") {
          if (!char.powers?.includes(value)) return false;
        } else {
          if (char[key] !== value) return false;
        }
      }
    }

    // ✅ ANY (OR) logic — at least one must pass
    const any = filters.any || {};
    if (Object.keys(any).length > 0) {
      const anyMatch = Object.entries(any).some(([key, value]) => {
        const list = Array.isArray(value) ? value : [value];
        if (key === "tagList") {
          return list.some(v => char.tagList?.includes(v));
        } else if (key === "powers") {
          return list.some(v => char.powers?.includes(v));
        } else {
          return list.includes(char[key]);
        }
      });
      if (!anyMatch) return false;
    }

    return true;
  });
}