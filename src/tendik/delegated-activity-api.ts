import {
    acknowledgeDelegatedActivityFor,
    getDelegatedActivityAcknowledgementFor,
    listDelegatedActivityAcknowledgementsFor,
} from '../shared/delegated-activity-api';
import type {
    DelegatedActivityAcknowledgement,
    DelegatedActivityFilters,
    DelegatedActivityListEnvelope,
} from './delegated-activity-types';

export { DelegatedActivityApiError } from '../shared/delegated-activity-api';

export const listDelegatedActivityAcknowledgements = async (
    filters: DelegatedActivityFilters = {},
): Promise<DelegatedActivityListEnvelope> =>
    listDelegatedActivityAcknowledgementsFor('tendik', filters);

export const getDelegatedActivityAcknowledgement = async (
    id: number,
): Promise<DelegatedActivityAcknowledgement> =>
    getDelegatedActivityAcknowledgementFor('tendik', id);

export const acknowledgeDelegatedActivity = async (
    id: number,
    note?: string,
): Promise<DelegatedActivityAcknowledgement> =>
    acknowledgeDelegatedActivityFor(id, note);
