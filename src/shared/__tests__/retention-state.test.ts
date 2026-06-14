import { describe, expect, it } from 'vitest';
import scholarshipSource from '../../mahasiswa/ScholarshipForm.ts?raw';
import skaSource from '../../mahasiswa/SuratKeteranganAktifForm.ts?raw';
import plnSource from '../../mahasiswa/ProsesLuarNegeriForm.ts?raw';
import magangSource from '../../mahasiswa/SuratPengantarMagangForm.ts?raw';
import suratTugasSource from '../../mahasiswa/SuratTugasForm.ts?raw';
import {
    FINAL_DOWNLOAD_EXPIRED_MESSAGE,
    SUPPORTING_DOCUMENTS_DELETED_MESSAGE,
    canDownloadFinalForMahasiswa,
    canPreviewGeneratedDocumentForRetention,
    canPreviewFinalForMahasiswa,
    resolveLetterRetentionState,
    resolveMahasiswaRetentionState,
    retentionAwareSupportingDescriptors,
    type LetterRetentionSummary,
} from '../retention-state';
import { LETTER_WORKFLOW_STATUS } from '../letter-workflow';

const activeSummary = (overrides: Partial<LetterRetentionSummary> = {}): LetterRetentionSummary => ({
    completed_at: '2026-06-01T00:00:00.000Z',
    final_download_available: true,
    final_download_expires_at: '2026-07-01T00:00:00.000Z',
    final_download_state: 'active',
    supporting_documents_state: 'retained',
    intermediate_artifacts_state: 'retained',
    ...overrides,
});

describe('Mahasiswa retention-state mapping', () => {
    it('maps a completed active-download state to one shared final-download gate', () => {
        const state = resolveMahasiswaRetentionState(activeSummary(), new Date('2026-06-20T00:00:00.000Z'));

        expect(state.finalDownloadAvailable).toBe(true);
        expect(state.finalDownloadExpired).toBe(false);
        expect(state.noticeHtml).toContain('Surat resmi dapat diunduh sampai');
        expect(resolveLetterRetentionState(activeSummary()).finalDownloadState).toBe('active');
        expect(canDownloadFinalForMahasiswa(LETTER_WORKFLOW_STATUS.COMPLETED, activeSummary())).toBe(true);
        expect(canPreviewFinalForMahasiswa(LETTER_WORKFLOW_STATUS.COMPLETED, activeSummary())).toBe(true);
        expect(canPreviewGeneratedDocumentForRetention(LETTER_WORKFLOW_STATUS.COMPLETED, activeSummary())).toBe(true);
    });

    it('marks active documents as near expiry without hiding download', () => {
        const state = resolveMahasiswaRetentionState(
            activeSummary({ final_download_expires_at: '2026-06-22T00:00:00.000Z' }),
            new Date('2026-06-20T00:00:00.000Z'),
        );

        expect(state.finalDownloadAvailable).toBe(true);
        expect(state.finalDownloadNearExpiry).toBe(true);
        expect(state.noticeHtml).toContain('Masa unduh hampir berakhir');
    });

    it('hides final download after expiry or archive without exposing archive fallback text', () => {
        const expired = activeSummary({
            final_download_available: false,
            final_download_state: 'expired',
        });
        const archived = activeSummary({
            final_download_available: false,
            final_download_state: 'archived',
        });

        const expiredState = resolveMahasiswaRetentionState(expired);
        const archivedState = resolveMahasiswaRetentionState(archived);

        expect(expiredState.finalDownloadAvailable).toBe(false);
        expect(expiredState.noticeHtml).toContain(FINAL_DOWNLOAD_EXPIRED_MESSAGE);
        expect(canDownloadFinalForMahasiswa(LETTER_WORKFLOW_STATUS.COMPLETED, expired)).toBe(false);
        expect(canPreviewFinalForMahasiswa(LETTER_WORKFLOW_STATUS.COMPLETED, archived)).toBe(false);
        expect(canPreviewGeneratedDocumentForRetention(LETTER_WORKFLOW_STATUS.COMPLETED, archived)).toBe(false);
        expect(archivedState.noticeHtml).toContain(FINAL_DOWNLOAD_EXPIRED_MESSAGE);
        expect(`${expiredState.noticeHtml}${archivedState.noticeHtml}`.toLowerCase()).not.toContain('archive');
        expect(`${expiredState.noticeHtml}${archivedState.noticeHtml}`.toLowerCase()).not.toContain('arsip');
    });

    it('keeps non-completed applications out of retention countdown', () => {
        const state = resolveMahasiswaRetentionState({
            completed_at: null,
            final_download_available: false,
            final_download_expires_at: null,
            final_download_state: 'not_started',
            supporting_documents_state: 'not_started',
            intermediate_artifacts_state: 'not_started',
        });

        expect(state.noticeHtml).toBe('');
        expect(canDownloadFinalForMahasiswa(LETTER_WORKFLOW_STATUS.SUBMITTED, activeSummary())).toBe(false);
        expect(canPreviewFinalForMahasiswa(LETTER_WORKFLOW_STATUS.READY_FOR_STUDENT_REVIEW, null)).toBe(true);
    });

    it('turns retention-deleted supporting documents into a safe empty gallery state', () => {
        const descriptors = retentionAwareSupportingDescriptors(
            activeSummary({ supporting_documents_state: 'deleted' }),
            [{
                key: 'proposal',
                label: 'Proposal',
                endpointUrl: '/api/mahasiswa/surat-pengantar-magang/1/supporting-documents/proposal/preview',
                available: true,
            }],
        );
        const state = resolveMahasiswaRetentionState(activeSummary({ supporting_documents_state: 'deleted' }));

        expect(descriptors).toEqual([]);
        expect(state.noticeHtml).toContain(SUPPORTING_DOCUMENTS_DELETED_MESSAGE);
        expect(state.supportingDocumentsEmptyLabel).toBe(SUPPORTING_DOCUMENTS_DELETED_MESSAGE);
    });

    it('keeps all five Mahasiswa detail pages on the shared retention helper path', () => {
        const sources = [scholarshipSource, skaSource, plnSource, magangSource, suratTugasSource];

        sources.forEach((source) => {
            expect(source).toContain('../shared/retention-state');
            expect(source).not.toMatch(/final_download_expires_at[^;]*new Date/);
            expect(source).not.toMatch(/archive_path|storage_path|checksum_sha256/);
        });
    });
});
