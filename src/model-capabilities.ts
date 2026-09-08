export function supportsImageInput(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  return id.includes('vision')
    || id.includes('-vl')
    || id.includes('omni')
    || id.includes('image')
    || id.includes('claude')
    || id.includes('gemini')
    || id.includes('gpt-4')
    || id.includes('gpt-5')
    || id.includes('glm-4')
    || id.includes('glm-5')
    || id.includes('glm-flash');
}
