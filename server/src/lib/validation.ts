import { z } from "zod";

const positiveIntString = (label: string) =>
  z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: `Invalid ${label}`,
  });

export const idParamSchema = z.object({
  id: positiveIntString("ID"),
});

export const locationIdParamSchema = z.object({
  locationId: positiveIntString("location ID"),
});
