import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { reaction } from 'mobx';
import { useStore, observer } from '@deriv/stores';
import { getLanguage } from '@deriv/translations';
import { Loading } from '@deriv/components';
import { routes, WS } from '@deriv/shared';
import ServerTime from 'Utils/server-time';
import { waitWS } from 'Utils/websocket';
import { useStores } from 'Stores';
import AppContent from './app-content.jsx';
import { setLanguage } from './i18next';
import { ModalManager, ModalManagerContextProvider } from './modal-manager';
import { init } from '../utils/server_time';
import Routes from './routes/routes.jsx';
import './app.scss';

const App = () => {
    const { notifications, client, ui, common, modules } = useStore();
    const { balance, is_logging_in } = client;
    const { setOnRemount } = modules?.cashier?.general_store;

    const { is_mobile } = ui;
    const { setP2POrderProps, setP2PRedirectTo } = notifications;

    const history = useHistory();
    const location = useLocation();

    const { buy_sell_store, general_store, order_store } = useStores();

    const lang = getLanguage();

    const [order_id, setOrderId] = React.useState(null);
    const [action_param, setActionParam] = React.useState();
    const [code_param, setCodeParam] = React.useState();

    React.useEffect(() => {
        init();

        general_store.setExternalStores({ client, common, modules, notifications, ui });
        general_store.setWebsocketInit(WS);
        general_store.getWebsiteStatus();

        setP2PRedirectTo({
            routeToMyProfile: () => {
                history.push(routes.p2p_my_profile);
                general_store.setActiveIndex(3);
            },
        });

        // Check if advertiser info has been subscribed to before the user navigates to
        // /advertiser?=id{counterparty_advertiser_id} from the url
        const disposeAdvertiserInfoSubscribedReaction = reaction(
            () => general_store.is_advertiser_info_subscribed,
            () => {
                if (
                    /\/advertiser$/.test(location.pathname) &&
                    general_store.is_advertiser_info_subscribed &&
                    general_store.counterparty_advertiser_id
                ) {
                    buy_sell_store.setShowAdvertiserPage(true);
                    history.push({
                        pathname: routes.p2p_advertiser_page,
                        search: `?id=${general_store.counterparty_advertiser_id}`,
                    });
                }
            }
        );

        // Redirect back to /p2p, this was implemented for the mobile team. Do not remove.
        if (/\/verification$/.test(location.pathname)) {
            localStorage.setItem('is_verifying_p2p', true);
            history.push(routes.p2p_my_ads);
        }

        ServerTime.init(general_store.server_time);

        // force safari refresh on back/forward
        window.onpageshow = function (event) {
            if (event.persisted) {
                window.location.reload();
            }
        };
        waitWS('authorize').then(() => {
            general_store.onMount();
            setOnRemount(general_store.onMount);
            if (localStorage.getItem('is_verifying_p2p')) {
                localStorage.removeItem('is_verifying_p2p');
                general_store.setActiveIndex(general_store.path.my_ads);
            }
        });

        if (/\/p2p$/.test(location.pathname)) {
            history.push(routes.p2p_buy_sell);
            general_store.setActiveIndex(0);
        } else if (/\/orders$/.test(location.pathname)) {
            history.push(routes.p2p_orders);
            general_store.setActiveIndex(1);
        } else if (/\/my-ads$/.test(location.pathname)) {
            history.push(routes.p2p_my_ads);
            general_store.setActiveIndex(2);
        } else if (/\/my-profile$/.test(location.pathname)) {
            history.push(routes.p2p_my_profile);
            general_store.setActiveIndex(3);
        } else if (/\/advertiser$/.test(location.pathname)) {
            if (location.search || general_store.counterparty_advertiser_id) {
                const url_params = new URLSearchParams(location.search);
                general_store.setCounterpartyAdvertiserId(url_params.get('id'));

                // DO NOT REMOVE. This will prevent the page from redirecting to buy sell on reload from advertiser page
                // as it resets the URL search params
                history.replace({ pathname: routes.p2p_advertiser_page, search: `?id=${url_params.get('id')}` });
            } else {
                history.push(routes.p2p_buy_sell);
            }
        }

        return () => {
            general_store.onUnmount();
            disposeAdvertiserInfoSubscribedReaction();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        const url_params = new URLSearchParams(location.search);

        let passed_order_id;

        setActionParam(url_params.get('action'));
        if (is_mobile) {
            setCodeParam(localStorage.getItem('verification_code.p2p_order_confirm'));
        } else if (!code_param) {
            if (url_params.has('code')) {
                setCodeParam(url_params.get('code'));
            } else if (localStorage.getItem('verification_code.p2p_order_confirm')) {
                setCodeParam(localStorage.getItem('verification_code.p2p_order_confirm'));
            }
        }

        // Different emails give us different params (order / order_id),
        // don't remove order_id since it's consistent for mobile and web for 2FA
        if (url_params.has('order_id')) {
            passed_order_id = url_params.get('order_id');
        } else if (url_params.has('order')) {
            passed_order_id = url_params.get('order');
        }

        if (passed_order_id) {
            setQueryOrder(passed_order_id);
        }

        return () => setQueryOrder(null);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setQueryOrder]);

    const setQueryOrder = React.useCallback(
        input_order_id => {
            const current_query_params = new URLSearchParams(location.search);

            if (is_mobile) {
                current_query_params.delete('action');
                current_query_params.delete('code');
            }

            if (current_query_params.has('order_id') || current_query_params.has('order')) {
                current_query_params.delete('order');
                current_query_params.delete('order_id');
            }

            if (input_order_id) {
                current_query_params.append('order', input_order_id);
            }

            if (!input_order_id) {
                history.replace({
                    search: '',
                    hash: location.hash,
                });

                setOrderId(null);
            } else if (order_id !== input_order_id) {
                // Changing query params
                history.push({
                    pathname: routes.p2p_orders,
                    search: current_query_params.toString(),
                    hash: location.hash,
                });

                setOrderId(input_order_id);
            }
        },

        // eslint-disable-next-line react-hooks/exhaustive-deps
        [history, location.hash, location.search]
    );

    React.useEffect(() => {
        setLanguage(lang);
    }, [lang]);

    const navigateToOrderDetails = id => {
        history.push({ pathname: routes.p2p_orders, search: `?order=${id}` });
    };

    React.useEffect(() => {
        if (order_id) {
            general_store.redirectTo('orders');
            order_store.setOrderId(order_id);
        }
        setP2POrderProps({
            order_id,
            redirectToOrderDetails: general_store.redirectToOrderDetails,
            setP2POrderTab: general_store.setP2POrderTab,
            setIsRatingModalOpen: is_open =>
                is_open ? general_store.showModal({ key: 'RatingModal' }) : general_store.hideModal(),
            navigateToOrderDetails,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order_id]);

    React.useEffect(() => {
        general_store.setAccountBalance(balance);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [balance]);

    React.useEffect(() => {
        if (code_param) {
            // We need an extra state since we delete the code from the query params.
            // Do not remove.
            order_store.setVerificationCode(code_param);
        }
        if (action_param && code_param) {
            general_store.showModal({ key: 'LoadingModal', props: {} });
            order_store.verifyEmailVerificationCode(action_param, code_param);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action_param, code_param]);

    if (is_logging_in || general_store.is_loading) {
        return <Loading is_fullscreen />;
    }

    return (
        <>
            <main className='p2p-cashier'>
                <ModalManagerContextProvider>
                    <ModalManager />
                    <AppContent order_id={order_id} />
                    <Routes />
                </ModalManagerContextProvider>
            </main>
        </>
    );
};

export default observer(App);
