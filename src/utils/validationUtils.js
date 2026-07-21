import { toValueArray } from './valueUtils';

export function validateItem(formData) {
  const isSeriesEmpty = toValueArray(formData.series).length === 0;
  const isCharacterEmpty = toValueArray(formData.character).length === 0;
  
  if (isSeriesEmpty && isCharacterEmpty) {
    return {
      isValid: false,
      errorKey: 'validationRequireOne'
    };
  }

  // Final type is either standard or a valid custom one
  const isTypeEmpty = !formData.merchandise_type || formData.merchandise_type.trim() === '' || formData.merchandise_type === '__custom__';

  if (isTypeEmpty) {
    return {
      isValid: false,
      errorKey: 'validationRequireType'
    };
  }

  return { isValid: true, errorKey: null };
}
