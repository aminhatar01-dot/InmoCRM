// Argenprop Sync Module
// Argenprop is Argentina's largest real estate portal.
// Integration typically requires an XML feed (Argenprop Data Feed Specification)
// or access to their Partner API (https://panel.argenprop.com/).
//
// This module implements the XML feed structure used by Argenprop.
// To activate, the agent must provide their Argenprop API key in Settings → Portals.

const ARGENPROP_FEED_URL = 'https://panel.argenprop.com/api/publicaciones';

export async function publishToArgenprop(property: any, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      tipo_operacion: property.status === 'alquilada' ? 'alquiler' : 'venta',
      tipo_propiedad: mapArgenpropType(property.type),
      titulo: property.title || '',
      descripcion: property.description || '',
      precio: property.price || 0,
      moneda: property.currency || 'USD',
      direccion: property.address || '',
      ciudad: property.city || '',
      dormitorios: property.bedrooms || 0,
      banos: property.bathrooms || 0,
      metros_cuadrados: property.areaSqM || 0,
      imagenes: (property.images || []).map((url: string) => ({ url })),
      latitud: property.lat || undefined,
      longitud: property.lng || undefined,
    };

    const response = await fetch(ARGENPROP_FEED_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Argenprop] Publish error:', response.status, err);
      return { success: false, error: `Argenprop API error ${response.status}` };
    }

    console.log('[Argenprop] Property published successfully');
    return { success: true };
  } catch (e: any) {
    console.error('[Argenprop] Publish exception:', e);
    return { success: false, error: e.message };
  }
}

export async function updateArgenpropListing(
  externalId: string,
  property: any,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      tipo_operacion: property.status === 'alquilada' ? 'alquiler' : 'venta',
      tipo_propiedad: mapArgenpropType(property.type),
      titulo: property.title || '',
      descripcion: property.description || '',
      precio: property.price || 0,
      moneda: property.currency || 'USD',
      direccion: property.address || '',
      ciudad: property.city || '',
      dormitorios: property.bedrooms || 0,
      banos: property.bathrooms || 0,
      metros_cuadrados: property.areaSqM || 0,
      imagenes: (property.images || []).map((url: string) => ({ url })),
      latitud: property.lat || undefined,
      longitud: property.lng || undefined,
    };

    const response = await fetch(`${ARGENPROP_FEED_URL}/${externalId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Argenprop] Update error:', response.status, err);
      return { success: false, error: `Argenprop API error ${response.status}` };
    }

    console.log(`[Argenprop] Listing ${externalId} updated`);
    return { success: true };
  } catch (e: any) {
    console.error('[Argenprop] Update exception:', e);
    return { success: false, error: e.message };
  }
}

function mapArgenpropType(inmoType: string): string {
  const map: Record<string, string> = {
    casa: 'casa',
    departamento: 'departamento',
    terreno: 'terreno',
    local: 'local_comercial',
    oficina: 'oficina',
  };
  return map[inmoType] || 'casa';
}
