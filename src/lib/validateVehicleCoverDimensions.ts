const COVER_WIDTH = 1220;
const COVER_HEIGHT = 880;

/**
 * Garante que a imagem de capa do veículo tem exatamente 1220×880 px.
 */
export function validateVehicleCoverDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth !== COVER_WIDTH || img.naturalHeight !== COVER_HEIGHT) {
        resolve(
          `A imagem de capa deve medir exatamente ${COVER_WIDTH}×${COVER_HEIGHT} px (medidas actuais: ${img.naturalWidth}×${img.naturalHeight} px).`,
        );
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Não foi possível ler a imagem de capa.");
    };
    img.src = url;
  });
}

export const VEHICLE_COVER_DIMENSIONS = { width: COVER_WIDTH, height: COVER_HEIGHT } as const;
