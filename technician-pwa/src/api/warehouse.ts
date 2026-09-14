import { api, equalFilter, filterQuery } from './client';
import type { Card } from '../types/api';
export const listWarehouse = (id: number) => api.data<Card[]>('classes/WrhMovement/cards?limit=100&' + filterQuery(equalFilter('MaintProcess',id)));
// No write implementation until stock-backed validation is possible on this installation.
