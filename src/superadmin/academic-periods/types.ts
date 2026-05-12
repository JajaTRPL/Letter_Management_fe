export type SemesterType = 'ganjil' | 'genap';

export interface AcademicPeriod {
    id: number;
    academic_year: string;
    year_start: number;
    semester_type: SemesterType;
    semester_order: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
