import classNames from 'classnames';
import React from 'react';
import { TradeParamsLoader } from 'App/Components/Elements/ContentLoader';
import Fieldset from 'App/Components/Form/fieldset.jsx';
import ContractType from '../../Containers/contract-type.jsx';
import Purchase from '../../Containers/purchase';
import TradeParams from '../../Containers/trade-params.jsx';

type TScreenLarge = {
    is_market_closed?: boolean;
    is_trade_enabled: boolean;
};
const ScreenLarge = ({ is_market_closed = false, is_trade_enabled }: TScreenLarge) => (
    <div
        className={classNames('sidebar__items', {
            'sidebar__items--market-closed': is_market_closed,
        })}
    >
        {!is_trade_enabled ? (
            <TradeParamsLoader speed={2} />
        ) : (
            <React.Fragment>
                <Fieldset className='trade-container__fieldset trade-types'>
                    <ContractType />
                </Fieldset>
                <TradeParams />
                <div className='purchase-container'>
                    <Purchase is_market_closed={is_market_closed} />
                </div>
            </React.Fragment>
        )}
    </div>
);

export default ScreenLarge;
