import { describe, it, expect } from 'vitest';
import {
    canCompleteSubmission,
    canDownloadDocument,
    getLetterLabel,
    isStudentReviewStage,
    LETTER_WORKFLOW_STATUS,
} from '../letter-workflow';

const {
    DRAFT, SUBMITTED, APPROVED_TENDIK, APPROVED_KAPRODI,
    READY_FOR_STUDENT_REVIEW, COMPLETED, REVISION, REJECTED,
} = LETTER_WORKFLOW_STATUS;

describe('letter-workflow action gates', () => {
    it('complete action is available only at Ready_For_Student_Review', () => {
        expect(canCompleteSubmission(READY_FOR_STUDENT_REVIEW)).toBe(true);
        for (const s of [DRAFT, SUBMITTED, APPROVED_TENDIK, APPROVED_KAPRODI, COMPLETED, REVISION, REJECTED]) {
            expect(canCompleteSubmission(s)).toBe(false);
        }
    });

    it('complete action requires the document to have been previewed', () => {
        expect(canCompleteSubmission(READY_FOR_STUDENT_REVIEW, false)).toBe(false);
        expect(canCompleteSubmission(READY_FOR_STUDENT_REVIEW, true)).toBe(true);
    });

    it('final download is available only at Completed', () => {
        expect(canDownloadDocument(COMPLETED)).toBe(true);
        for (const s of [DRAFT, SUBMITTED, APPROVED_TENDIK, APPROVED_KAPRODI, READY_FOR_STUDENT_REVIEW, REVISION, REJECTED]) {
            expect(canDownloadDocument(s)).toBe(false);
        }
    });

    it('isStudentReviewStage only matches Ready_For_Student_Review', () => {
        expect(isStudentReviewStage(READY_FOR_STUDENT_REVIEW)).toBe(true);
        expect(isStudentReviewStage(COMPLETED)).toBe(false);
    });
});

describe('letter-workflow labels', () => {
    it('resolves canonical letter labels including Surat Tugas', () => {
        expect(getLetterLabel('surat-tugas')).toBe('Surat Tugas');
        expect(getLetterLabel('surat-pengantar-magang')).toBe('Surat Pengantar Magang');
        expect(getLetterLabel('surat-permohonan-beasiswa')).toBe('Surat Permohonan Beasiswa');
        expect(getLetterLabel('surat-keterangan-aktif')).toBe('Surat Keterangan Aktif');
        expect(getLetterLabel('proses-luar-negeri')).toBe('Proses Luar Negeri');
    });

    it('keeps Surat Tugas distinct from Magang', () => {
        expect(getLetterLabel('surat-tugas')).not.toBe(getLetterLabel('surat-pengantar-magang'));
    });
});
