#!/bin/bash -e
mkdir -p build/circuits

# Compile circuit
circom circuits/withdraw.circom --r1cs --wasm --output build/circuits

cd build/circuits
# Download Power of Tau
PowerOfTauFile="powersOfTau28_hez_final_16.ptau"
if [ ! -f ${PowerOfTauFile} ]; then
    curl https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau > ${PowerOfTauFile}
fi

# Setup key
npx snarkjs plonk setup withdraw.r1cs ${PowerOfTauFile} circuit_withdraw_final.zkey

# Verify the final zkey
# npx snarkjs zkey verify withdraw.r1cs ${PowerOfTauFile} circuit_withdraw_final.zkey

# Export the verification key
npx snarkjs zkey export verificationkey circuit_withdraw_final.zkey withdraw_verification_key.json 

# Generate verificatoin smart contract
npx snarkjs zkey export solidityverifier circuit_withdraw_final.zkey Verifier.sol
# Replace version
sed -i 's/0.6.11/0.8.0/g' Verifier.sol

cp Verifier.sol ../../contracts
rm -f ../contracts/Verifier.json
cd ../..
