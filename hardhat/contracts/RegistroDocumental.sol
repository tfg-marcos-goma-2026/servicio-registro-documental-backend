// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RegistroDocumental {

    struct Documento {
        address emisor;
        uint256 timestamp;
        bool existe;
    }

    mapping(bytes32 => Documento) public registro;

    event DocumentoRegistrado(
        bytes32 indexed hash, 
        address indexed emisor, 
        uint256 timestamp
    );

    function registrar(bytes32 _hash) public {
        require(!registro[_hash].existe, "El documento ya esta registrado");

        registro[_hash] = Documento({
            emisor: msg.sender,
            timestamp: block.timestamp,
            existe: true
        });

        emit DocumentoRegistrado(_hash, msg.sender, block.timestamp);
    }

    function verificar(bytes32 _hash) public view returns (bool, address, uint256) {
        Documento memory doc = registro[_hash];
        return (doc.existe, doc.emisor, doc.timestamp);
    }
}