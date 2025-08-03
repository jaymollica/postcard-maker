import { TailSpin } from 'svg-loaders-react';

export const ButtonLabelVerify = function(str){
    return (
        <>
            <span>{str}</span>
            <svg width="23" height="14" xmlns="http://www.w3.org/2000/svg" className="icon-arrow">
                <path d="M17.001 0L23 6.069v1.848L17 14l-.995-.997 5.077-5.146v-.125H.652V6.268h20.43v-.125l-5.076-5.139L17.001 0z" fill="#2F2F2F"></path>
            </svg>
        </>
    );
}

export const ButtonLabelVerifying = function(str){
    return (
        <>
            <span>{str}</span>
            <TailSpin className="tailspin" />
        </>
    );
}

export const ButtonLabelVerified = function(str){
    return (
        <>
            <span>{str}</span>
            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
        </>
    );
}