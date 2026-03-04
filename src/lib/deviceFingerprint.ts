const FINGERPRINT_CACHE_KEY = 'jz_device_fp';

// Generate a unique device fingerprint using browser characteristics
// Caches result in localStorage to avoid instability from canvas/WebGL fluctuations
export async function generateDeviceFingerprint(): Promise<string> {
  // Return cached fingerprint if available — ensures stability across sessions
  const cached = localStorage.getItem(FINGERPRINT_CACHE_KEY);
  if (cached && cached.length === 64) {
    return cached;
  }

  const components: string[] = [];

  // Screen info
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Language
  components.push(navigator.language);

  // Platform
  components.push(navigator.platform);

  // Hardware concurrency
  components.push(String(navigator.hardwareConcurrency || 0));

  // Device memory (if available)
  components.push(String((navigator as any).deviceMemory || 0));

  // User agent - use only stable parts (browser family + OS), not full UA which changes on updates
  const ua = navigator.userAgent;
  const stableUA = ua.replace(/\b\d+\.\d+\.\d+\.\d+\b/g, 'X').replace(/\b\d+\.\d+\b/g, 'X');
  components.push(stableUA);

  // Touch support
  components.push(String(navigator.maxTouchPoints || 0));

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('JurisZap', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('LB013', 4, 17);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    components.push('canvas-error');
  }

  // WebGL info
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getParameter' in gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    components.push('webgl-error');
  }

  // Hash the components
  const fingerprintString = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Cache for stability
  localStorage.setItem(FINGERPRINT_CACHE_KEY, hashHex);

  return hashHex;
}

// Clear cached fingerprint (call on explicit signOut so re-login recalculates)
export function clearCachedFingerprint() {
  localStorage.removeItem(FINGERPRINT_CACHE_KEY);
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera')) browser = 'Opera';

  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let device = 'Desktop';
  if (ua.includes('Mobile')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';

  return { browser, os, device };
}