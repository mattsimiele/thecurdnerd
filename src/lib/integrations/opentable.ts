export interface ReservationSummary {
  serviceDate: string;
  covers: number;
  reservations: number;
  cancellations: number;
  noShows: number;
}

export interface ReservationProvider {
  getSummary(restaurantId: string, serviceDate: string): Promise<ReservationSummary>;
}

export class OpenTableProvider implements ReservationProvider {
  async getSummary(): Promise<ReservationSummary> {
    throw new Error("OpenTable access is not configured. API availability and endpoints depend on the restaurant's partner agreement.");
  }
}
