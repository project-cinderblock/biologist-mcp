import axios, { AxiosInstance, AxiosError } from "axios";
import { ServerConfig } from "../config.js";
import {
  ApiResponse,
  PlatformStatus,
  PlatformSettings,
  Biome,
  Species,
  Organism,
  LiveClusterResult,
  ClusterSnapshot,
  ClusterGroup,
  ClusterReport,
  ClusterReportSummary,
  ClusterSubReport,
  JobStatus
} from "./types.js";

export class BiologistApiError extends Error {
  public code: string;
  public status?: number;
  public details?: string[];

  constructor(message: string, code = "api_error", status?: number, details?: string[]) {
    super(message);
    this.name = "BiologistApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class BiologistApiClient {
  private http: AxiosInstance;
  public readonly apiUrl: string;

  constructor(config: ServerConfig) {
    this.apiUrl = config.apiUrl;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    }

    this.http = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeoutMs,
      headers
    });
  }

  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosErr = error as AxiosError<{ error?: { code?: string; message?: string; details?: string[] } }>;
      const status = axiosErr.response?.status;
      const errorPayload = axiosErr.response?.data?.error;

      if (errorPayload) {
        throw new BiologistApiError(
          errorPayload.message || axiosErr.message,
          errorPayload.code || "api_error",
          status,
          errorPayload.details
        );
      }

      throw new BiologistApiError(
        axiosErr.message,
        status ? `http_${status}` : "network_error",
        status
      );
    }

    if (error instanceof Error) {
      throw new BiologistApiError(error.message);
    }

    throw new BiologistApiError(String(error));
  }

  // System & Status
  async getStatus(): Promise<PlatformStatus> {
    try {
      const res = await this.http.get<ApiResponse<PlatformStatus>>("/status");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOpenApiSpec(): Promise<Record<string, unknown>> {
    try {
      const res = await this.http.get<Record<string, unknown>>("/openapi.json");
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      const res = await this.http.get<ApiResponse<PlatformSettings>>("/settings");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateContextWindow(contextWindow: number): Promise<unknown> {
    try {
      const res = await this.http.patch<ApiResponse<unknown>>("/settings/context_window", {
        context_window: contextWindow
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateBulkEmbeddings(modelType: "Species" | "Organism", onlyMissing = true): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/settings/generate_embeddings", {
        model_type: modelType,
        only_missing: onlyMissing
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Global Search
  async search(params: {
    q: string;
    mode?: "semantic" | "keyword" | "auto";
    target_type?: "all" | "species" | "organism";
    limit?: number;
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.http.get<ApiResponse<unknown>>("/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Biomes
  async listBiomes(params?: {
    q?: string;
    include_species?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Biome[]>> {
    try {
      const res = await this.http.get<ApiResponse<Biome[]>>("/biomes", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getBiome(id: number, params?: { include_species?: boolean }): Promise<Biome> {
    try {
      const res = await this.http.get<ApiResponse<Biome>>(`/biomes/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createBiome(biome: { name: string; description?: string }): Promise<Biome> {
    try {
      const res = await this.http.post<ApiResponse<Biome>>("/biomes", { biome });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateBiome(id: number, biome: { name?: string; description?: string }): Promise<Biome> {
    try {
      const res = await this.http.patch<ApiResponse<Biome>>(`/biomes/${id}`, { biome });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteBiome(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(
        `/biomes/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateBiomes(): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/biomes/populate");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateBiomeSpecies(
    biomeId: number,
    options?: { count?: number; sync?: boolean }
  ): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/biomes/${biomeId}/populate_species`,
        {},
        { params: options }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertBiomesBatch(biomes: Array<{ name: string; description: string }>): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/biomes/upsert_batch", { biomes });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Species
  async listSpecies(params?: {
    biome_id?: number;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_embedding?: boolean;
    include_organisms?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Species[]>> {
    try {
      const res = await this.http.get<ApiResponse<Species[]>>("/species", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSpecies(
    id: number,
    params?: { include_embedding?: boolean; include_organisms?: boolean }
  ): Promise<Species> {
    try {
      const res = await this.http.get<ApiResponse<Species>>(`/species/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createSpecies(species: {
    biome_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<Species> {
    try {
      const res = await this.http.post<ApiResponse<Species>>("/species", { species });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateSpecies(
    id: number,
    species: {
      biome_id?: number;
      name?: string;
      description?: string;
      themes?: string[];
    }
  ): Promise<Species> {
    try {
      const res = await this.http.patch<ApiResponse<Species>>(`/species/${id}`, { species });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteSpecies(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(
        `/species/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getSpeciesNeighbors(
    id: number,
    params?: { limit?: number; threshold?: number }
  ): Promise<Species[]> {
    try {
      const res = await this.http.get<ApiResponse<Species[]>>(`/species/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateSpeciesEmbedding(id: number, params?: { sync?: boolean }): Promise<Species> {
    try {
      const res = await this.http.post<ApiResponse<Species>>(
        `/species/${id}/generate_embedding`,
        {},
        { params }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateSpeciesOrganisms(
    speciesId: number,
    options?: { count?: number; sync?: boolean }
  ): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>(
        `/species/${speciesId}/populate_organisms`,
        {},
        { params: options }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateSpeciesBulk(): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/species/populate");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertSpeciesBatch(
    biomeId: number,
    species: Array<{ name: string; description: string; themes?: string[] }>
  ): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/species/upsert_batch", {
        biome_id: biomeId,
        species
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async searchSpecies(params: {
    q: string;
    limit?: number;
    include_embedding?: boolean;
  }): Promise<ApiResponse<Species[]>> {
    try {
      const res = await this.http.get<ApiResponse<Species[]>>("/species/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Organisms
  async listOrganisms(params?: {
    species_id?: number;
    biome_id?: number;
    theme?: string;
    q?: string;
    embedded?: boolean;
    include_embedding?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Organism[]>> {
    try {
      const res = await this.http.get<ApiResponse<Organism[]>>("/organisms", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOrganism(id: number, params?: { include_embedding?: boolean }): Promise<Organism> {
    try {
      const res = await this.http.get<ApiResponse<Organism>>(`/organisms/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createOrganism(organism: {
    species_id: number;
    name: string;
    description?: string;
    themes?: string[];
  }): Promise<Organism> {
    try {
      const res = await this.http.post<ApiResponse<Organism>>("/organisms", { organism });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async updateOrganism(
    id: number,
    organism: {
      species_id?: number;
      name?: string;
      description?: string;
      themes?: string[];
    }
  ): Promise<Organism> {
    try {
      const res = await this.http.patch<ApiResponse<Organism>>(`/organisms/${id}`, { organism });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteOrganism(id: number): Promise<{ id: number; name: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; name: string; deleted: boolean }>>(
        `/organisms/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getOrganismNeighbors(
    id: number,
    params?: { limit?: number; threshold?: number }
  ): Promise<Organism[]> {
    try {
      const res = await this.http.get<ApiResponse<Organism[]>>(`/organisms/${id}/neighbors`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async generateOrganismEmbedding(id: number, params?: { sync?: boolean }): Promise<Organism> {
    try {
      const res = await this.http.post<ApiResponse<Organism>>(
        `/organisms/${id}/generate_embedding`,
        {},
        { params }
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async populateOrganismsBulk(): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/organisms/populate");
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async upsertOrganismsBatch(
    speciesId: number,
    organisms: Array<{ name: string; description: string; themes?: string[] }>
  ): Promise<unknown> {
    try {
      const res = await this.http.post<ApiResponse<unknown>>("/organisms/upsert_batch", {
        species_id: speciesId,
        organisms
      });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async searchOrganisms(params: {
    q: string;
    limit?: number;
    include_embedding?: boolean;
  }): Promise<ApiResponse<Organism[]>> {
    try {
      const res = await this.http.get<ApiResponse<Organism[]>>("/organisms/search", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Clusters & Snapshots
  async computeClusters(params: {
    target_type?: "Species" | "Organism";
    level?: number;
    full_coverage?: boolean;
    force?: boolean;
  }): Promise<LiveClusterResult> {
    try {
      const res = await this.http.get<ApiResponse<LiveClusterResult>>("/clusters", { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterSnapshot(data: {
    target_type?: "Species" | "Organism";
    level?: number;
    full_coverage?: boolean;
    title?: string;
  }): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.post<ApiResponse<ClusterSnapshot>>("/clusters/snapshot", data);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSnapshots(params?: {
    target_type?: "Species" | "Organism";
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterSnapshot[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot[]>>("/cluster_snapshots", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSnapshot(
    id: number,
    params?: {
      include_groups?: boolean;
      include_members?: boolean;
      include_reports?: boolean;
    }
  ): Promise<ClusterSnapshot> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSnapshot>>(`/cluster_snapshots/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterSnapshot(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_snapshots/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterGroups(
    clusterSnapshotId: number,
    params?: {
      include_members?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<ClusterGroup[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup[]>>(
        `/cluster_snapshots/${clusterSnapshotId}/cluster_groups`,
        { params }
      );
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterGroup(id: number, params?: { include_members?: boolean }): Promise<ClusterGroup> {
    try {
      const res = await this.http.get<ApiResponse<ClusterGroup>>(`/cluster_groups/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Synthesis Reports
  async listClusterReports(params?: {
    cluster_snapshot_id?: number;
    target_type?: "Species" | "Organism";
    status?: string;
    is_detailed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ClusterReport[]>> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport[]>>("/cluster_reports", { params });
      return res.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReport(
    id: number,
    params?: {
      include_summaries?: boolean;
      include_sub_reports?: boolean;
    }
  ): Promise<ClusterReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReport>>(`/cluster_reports/${id}`, { params });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async createClusterReport(data: {
    cluster_snapshot_id: number;
    prompt: string;
  }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>("/cluster_reports", data);
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deleteClusterReport(id: number): Promise<{ id: number; title: string; deleted: boolean }> {
    try {
      const res = await this.http.delete<ApiResponse<{ id: number; title: string; deleted: boolean }>>(
        `/cluster_reports/${id}`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async deepSynthesis(reportId: number, data?: { batch_size?: number }): Promise<ClusterReport> {
    try {
      const res = await this.http.post<ApiResponse<ClusterReport>>(
        `/cluster_reports/${reportId}/deep_synthesis`,
        data || {}
      );
      const report = res.data.data;
      if (res.data.meta && (res.data.meta as Record<string, unknown>).job_id) {
        report.job_id = (res.data.meta as Record<string, unknown>).job_id as string;
      }
      return report;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForClusterReport(
    id: number,
    pollIntervalMs = 5000,
    timeoutMs = 600000
  ): Promise<ClusterReport> {
    const startTime = Date.now();
    let lastReport: ClusterReport | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const report = await this.getClusterReport(id, {
        include_summaries: false,
        include_sub_reports: false
      });
      lastReport = report;
      if (report.status === "completed") {
        return await this.getClusterReport(id, {
          include_summaries: false,
          include_sub_reports: true
        });
      }
      if (report.status === "failed") {
        throw new BiologistApiError(
          report.error_message || `Cluster report ${id} failed`,
          "report_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastReport && (lastReport.status === "running" || lastReport.status === "queued")) {
      return {
        ...lastReport,
        timed_out: true,
        is_running: true
      };
    }
    throw new BiologistApiError(
      `Cluster report ${id} timed out after ${timeoutMs}ms while waiting for completion`,
      "report_timeout"
    );
  }

  async listClusterReportSummaries(clusterReportId: number): Promise<ClusterReportSummary[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary[]>>(
        `/cluster_reports/${clusterReportId}/summaries`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterReportSummary(id: number): Promise<ClusterReportSummary> {
    try {
      const res = await this.http.get<ApiResponse<ClusterReportSummary>>(`/cluster_report_summaries/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async listClusterSubReports(clusterReportId: number): Promise<ClusterSubReport[]> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport[]>>(
        `/cluster_reports/${clusterReportId}/sub_reports`
      );
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getClusterSubReport(id: number): Promise<ClusterSubReport> {
    try {
      const res = await this.http.get<ApiResponse<ClusterSubReport>>(`/cluster_sub_reports/${id}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  // Jobs
  async listJobs(limit = 20): Promise<JobStatus[]> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus[]>>("/jobs", { params: { limit } });
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async getJob(jobId: string): Promise<JobStatus> {
    try {
      const res = await this.http.get<ApiResponse<JobStatus>>(`/jobs/${jobId}`);
      return res.data.data;
    } catch (err) {
      return this.handleError(err);
    }
  }

  async waitForJob(jobId: string, pollIntervalMs = 2000, timeoutMs = 60000): Promise<JobStatus> {
    const startTime = Date.now();
    let lastJob: JobStatus | null = null;
    while (Date.now() - startTime < timeoutMs) {
      const job = await this.getJob(jobId);
      lastJob = job;
      if (job.status === "completed") {
        return job;
      }
      if (job.status === "failed") {
        throw new BiologistApiError(
          job.error || job.message || `Job ${jobId} failed`,
          "job_failed"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    if (lastJob && (lastJob.status === "running" || lastJob.status === "queued")) {
      return {
        ...lastJob,
        timed_out: true,
        is_running: true,
        message: `Job ${jobId} is still ${lastJob.status} in the background after ${timeoutMs}ms. Do NOT retry or duplicate.`
      };
    }
    throw new BiologistApiError(
      `Job ${jobId} timed out after ${timeoutMs}ms while waiting for completion`,
      "job_timeout"
    );
  }
}
