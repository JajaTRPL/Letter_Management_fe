// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
    renderFormActionFooter,
    renderFormField,
    renderFormSectionCard,
} from '../form-primitives';

describe('form-primitives', () => {
    it('renders escaped section, field helper, required indicator, and validation error content', () => {
        const field = renderFormField({
            id: 'field-name',
            label: '<Nama>',
            required: true,
            helperText: '<helper>',
            errorId: 'field-name-error',
            error: '<invalid>',
            controlHtml: '<input id="field-name">',
        });
        const html = renderFormSectionCard({ title: '<Title>', body: field });

        expect(html).toContain('&lt;Title&gt;');
        expect(html).toContain('for="field-name"');
        expect(html).toContain('&lt;Nama&gt;');
        expect(html).toContain('&lt;helper&gt;');
        expect(html).toContain('&lt;invalid&gt;');
        expect(html).toContain('aria-hidden="true">*</span>');
    });

    it('omits empty section cards when requested', () => {
        expect(renderFormSectionCard({ body: '', omitWhenEmpty: true })).toBe('');
    });

    it('renders loading and disabled action-footer presentation without executable markup', () => {
        const html = renderFormActionFooter({
            previous: { id: 'prev', label: '<Back>' },
            next: { id: 'next', label: 'Submit', loading: true },
        });

        expect(html).toContain('id="next" type="button" disabled');
        expect(html).toContain('Memproses...');
        expect(html).toContain('&lt;Back&gt;');
    });
});
