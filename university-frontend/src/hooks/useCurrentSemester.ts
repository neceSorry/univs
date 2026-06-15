export const useCurrentSemester = () => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  let period: 'autumn' | 'spring';
  let academicYear = '';

  if (month >= 9 || month === 1) {
    period = 'autumn';
    academicYear = month === 1 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  } else {
    period = 'spring';
    academicYear = `${year - 1}-${year}`;
  }

  // semester kept for display label only
  const semester = period === 'autumn' ? 1 : 2;

  return { semester, period, academicYear };
};
