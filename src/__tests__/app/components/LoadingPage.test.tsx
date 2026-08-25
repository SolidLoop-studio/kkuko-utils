import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import LoadingPage from '@/src/app/components/LoadingPage';
import { updateLoadingState } from '@/src/app/store/slice';
import { store } from '@/src/app/store/store';

const renderLoadingPage = (isForcedVisible?: boolean) => render(
    <Provider store={store}>
        <LoadingPage title="문서 로그" isForcedVisible={isForcedVisible} />
    </Provider>,
);

describe('LoadingPage', () => {
    beforeEach(() => {
        store.dispatch(updateLoadingState({ progress: 100, task: '완료' }));
    });

    it('keeps completed Redux loading state hidden without an override', () => {
        renderLoadingPage();

        expect(screen.queryByRole('heading', { name: '문서 로그 로딩 중' })).not.toBeInTheDocument();
    });

    it('shows a generic loading state when forced visible after Redux loading completes', () => {
        renderLoadingPage(true);

        expect(screen.getByRole('heading', { name: '문서 로그 로딩 중' })).toBeInTheDocument();
        expect(screen.getByText('로딩 중...')).toBeInTheDocument();
        expect(screen.getByText('0% 완료')).toBeInTheDocument();
    });
});
